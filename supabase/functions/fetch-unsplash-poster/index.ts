import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { place_id, force } = await req.json();
    if (!place_id) throw new Error("place_id is required");

    const UNSPLASH_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY")?.trim();
    if (!UNSPLASH_KEY) throw new Error("UNSPLASH_ACCESS_KEY not configured");

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

    // Get all already-used Unsplash photo ids to enforce uniqueness across places
    const { data: usedRows } = await supabase
      .from("places")
      .select("id, image")
      .not("image", "is", null);
    const usedPhotoIds = new Set<string>();
    for (const r of usedRows || []) {
      if (r.id === place.id) continue;
      const m = (r.image as string)?.match(/photo-([a-zA-Z0-9_-]+)/);
      if (m) usedPhotoIds.add(m[1]);
    }

    // Try multiple queries — prefer wide cityscape/aerial views over single buildings
    const queries =
      place.type === "city"
        ? [
            `${place.name} ${place.country} aerial cityscape skyline`,
            `${place.name} ${place.country} city skyline panorama`,
            `${place.name} ${place.country} cityscape`,
            `${place.name} ${place.country}`,
          ]
        : [
            `${place.name} landscape aerial`,
            `${place.name} landscape`,
            `${place.name}`,
          ];

    const HUMAN_TAGS = new Set([
      "person","people","man","woman","human","face","portrait","selfie",
      "crowd","boy","girl","kid","child","model","wedding",
    ]);
    const WIDE_HINTS = [
      "skyline","cityscape","aerial","panorama","panoramic","city","downtown",
      "drone","overview","view","harbour","harbor","bay","coast",
    ];
    const NARROW_PENALTIES = [
      "close-up","closeup","macro","interior","inside","facade","detail",
      "door","window","sign","statue","sculpture","food","plate","menu",
    ];

    let chosen: any = null;
    let chosenPhotoId: string | null = null;

    for (const query of queries) {
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("orientation", "portrait");
      url.searchParams.set("per_page", "30");
      url.searchParams.set("order_by", "relevant");
      url.searchParams.set("content_filter", "high");

      const resp = await fetch(url.toString(), {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_KEY}`,
          "Accept-Version": "v1",
        },
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("Unsplash error", resp.status, t);
        continue;
      }
      const data = await resp.json();
      const results: any[] = data.results || [];
      if (results.length === 0) continue;

      // Filter: no humans + not already used
      const filtered = results.filter((p) => {
        if (usedPhotoIds.has(p.id)) return false;
        const tags = [
          ...(p.tags || []),
          ...(p.tags_preview || []),
        ].map((t: any) => (t?.title || "").toLowerCase());
        const desc = `${p.description || ""} ${p.alt_description || ""}`.toLowerCase();
        if (tags.some((t) => HUMAN_TAGS.has(t))) return false;
        for (const word of HUMAN_TAGS) {
          if (desc.includes(word)) return false;
        }
        return true;
      });

      if (filtered.length === 0) continue;

      // Score: likes + wide-shot bonuses - narrow penalties
      const scored = filtered.map((p) => {
        const tags = [
          ...(p.tags || []),
          ...(p.tags_preview || []),
        ].map((t: any) => (t?.title || "").toLowerCase());
        const text = `${p.description || ""} ${p.alt_description || ""} ${tags.join(" ")}`.toLowerCase();
        let score = p.likes || 0;
        for (const w of WIDE_HINTS) if (text.includes(w)) score += 50;
        for (const w of NARROW_PENALTIES) if (text.includes(w)) score -= 80;
        return { p, score };
      });
      scored.sort((a, b) => b.score - a.score);
      chosen = scored[0].p;
      chosenPhotoId = chosen.id;
      break;
    }

    if (!chosen) throw new Error("No suitable photos found");
    if (chosenPhotoId) usedPhotoIds.add(chosenPhotoId);

    const baseUrl = chosen.urls?.raw || chosen.urls?.full;
    if (!baseUrl) throw new Error("No image URL");
    const imageUrl = `${baseUrl}&w=900&h=1200&fit=crop&crop=entropy&q=80&fm=jpg`;

    if (chosen.links?.download_location) {
      fetch(chosen.links.download_location, {
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
      }).catch(() => {});
    }

    await supabase
      .from("places")
      .update({ image: imageUrl })
      .eq("id", place.id);

    return new Response(
      JSON.stringify({
        image_url: imageUrl,
        photo_id: chosenPhotoId,
        photographer: chosen.user?.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-unsplash-poster error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
