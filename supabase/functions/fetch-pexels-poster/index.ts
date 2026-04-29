import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function extractPexelsId(url: string): string | null {
  // Pexels CDN URLs look like: https://images.pexels.com/photos/12345/pexels-photo-12345.jpeg
  const m = url.match(/\/photos\/(\d+)\//);
  return m ? m[1] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { place_id, force } = await req.json();
    if (!place_id) throw new Error("place_id is required");

    const PEXELS_KEY = Deno.env.get("PEXELS_API_KEY")?.trim();
    if (!PEXELS_KEY) throw new Error("PEXELS_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: place, error: placeError } = await supabase
      .from("places")
      .select("id, name, country, type, image")
      .eq("id", place_id)
      .single();

    if (placeError || !place) throw new Error("Place not found");
    if (place.image && !force) {
      return new Response(JSON.stringify({ image_url: place.image, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track all already-used Pexels photo ids to enforce uniqueness (paginated to bypass 1000-row default limit)
    const usedPexelsIds = new Set<string>();
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data: usedRows, error: usedErr } = await supabase
        .from("places")
        .select("id, image")
        .not("image", "is", null)
        .range(from, from + PAGE - 1);
      if (usedErr) {
        console.error("dedup fetch error", usedErr);
        break;
      }
      const rows = usedRows || [];
      for (const r of rows) {
        if (r.id === place.id) continue;
        const pid = extractPexelsId((r.image as string) || "");
        if (pid) usedPexelsIds.add(pid);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    console.log(`Dedup set size: ${usedPexelsIds.size}`);

    const queries =
      place.type === "city"
        ? [
            `${place.name} ${place.country} aerial cityscape skyline`,
            `${place.name} ${place.country} city skyline panorama`,
            `${place.name} ${place.country} cityscape`,
            `${place.name} ${place.country} city`,
            `${place.name} ${place.country}`,
            `${place.name} skyline`,
            `${place.name}`,
          ]
        : [
            `${place.name} landscape aerial`,
            `${place.name} landscape`,
            `${place.name}`,
          ];

    const HUMAN_RE = /\b(selfie|portrait of|wedding|bride|groom|model posing|couple posing)\b/i;
    const WIDE_HINTS = [
      "skyline","cityscape","aerial","panorama","panoramic","city","downtown",
      "drone","overview","view","harbour","harbor","bay","coast","old town",
      "rooftops","square","plaza",
    ];
    const NARROW_PENALTIES = [
      "close-up","closeup","macro","interior","inside","facade","detail",
      "door","window","sign","statue","sculpture","food","plate","menu",
      "person","selfie","portrait",
    ];

    let chosen: any = null;
    let chosenPexelsId: string | null = null;

    for (const query of queries) {
      const url = new URL("https://api.pexels.com/v1/search");
      url.searchParams.set("query", query);
      url.searchParams.set("per_page", "80");
      url.searchParams.set("orientation", "portrait");
      url.searchParams.set("size", "large");

      const resp = await fetch(url.toString(), {
        headers: { Authorization: PEXELS_KEY },
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("Pexels error", resp.status, t);
        continue;
      }
      const data = await resp.json();
      const results: any[] = data.photos || [];
      if (results.length === 0) continue;

      const filtered = results.filter((p) => {
        const pid = String(p.id);
        if (usedPexelsIds.has(pid)) return false;
        const alt = (p.alt || "").toLowerCase();
        if (HUMAN_RE.test(alt)) return false;
        return true;
      });

      if (filtered.length === 0) continue;

      const scored = filtered.map((p) => {
        const text = `${p.alt || ""} ${p.photographer || ""}`.toLowerCase();
        let score = 0;
        for (const w of WIDE_HINTS) if (text.includes(w)) score += 50;
        for (const w of NARROW_PENALTIES) if (text.includes(w)) score -= 80;
        // Slight preference for taller images (portrait) — already filtered, but bonus for >1.2 ratio
        if (p.height && p.width && p.height / p.width > 1.2) score += 10;
        return { p, score };
      });
      scored.sort((a, b) => b.score - a.score);
      chosen = scored[0].p;
      chosenPexelsId = String(chosen.id);
      break;
    }

    // Fallback: relax filters — try landscape orientation if portrait failed
    if (!chosen) {
      for (const query of queries) {
        const url = new URL("https://api.pexels.com/v1/search");
        url.searchParams.set("query", query);
        url.searchParams.set("per_page", "80");
        url.searchParams.set("size", "large");

        const resp = await fetch(url.toString(), {
          headers: { Authorization: PEXELS_KEY },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const results: any[] = data.photos || [];
        const filtered = results.filter((p) => !usedPexelsIds.has(String(p.id)));
        if (filtered.length === 0) continue;
        chosen = filtered[0];
        chosenPexelsId = String(chosen.id);
        break;
      }
    }

    if (!chosen) throw new Error("No suitable photos found");

    // Pexels src has multiple sizes; use "large" (already cropped/optimized) or build a custom one
    // src.large is ~940px wide. For poster 3:4 we use "portrait" which is 800x1200.
    const imageUrl = chosen.src?.portrait || chosen.src?.large || chosen.src?.original;
    if (!imageUrl) throw new Error("No image URL");

    await supabase
      .from("places")
      .update({ image: imageUrl })
      .eq("id", place.id);

    return new Response(
      JSON.stringify({
        image_url: imageUrl,
        photo_id: chosenPexelsId,
        photographer: chosen.photographer,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-pexels-poster error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
