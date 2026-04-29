import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function extractPexelsId(url: string): string | null {
  const m = url.match(/\/photos\/(\d+)\//);
  return m ? m[1] : null;
}
function extractUnsplashId(url: string): string | null {
  const m = url.match(/photo-([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

const HUMAN_RE = /\b(selfie|portrait of|wedding|bride|groom|model posing|couple posing)\b/i;
const WIDE_HINTS = [
  "skyline","cityscape","aerial","panorama","panoramic","city","downtown",
  "drone","overview","view","harbour","harbor","bay","coast","old town",
  "rooftops","square","plaza","canal","bridge","river",
];
const NARROW_PENALTIES = [
  "close-up","closeup","macro","interior","inside","facade","detail",
  "door","window","sign","statue","sculpture","food","plate","menu",
  "person","selfie","portrait",
];

type Candidate = {
  provider: "pexels" | "unsplash";
  id: string;
  url: string;
  score: number;
  photographer?: string;
  downloadLocation?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { place_id, force } = await req.json();
    if (!place_id) throw new Error("place_id is required");

    const PEXELS_KEY = Deno.env.get("PEXELS_API_KEY")?.trim();
    const UNSPLASH_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY")?.trim();
    if (!PEXELS_KEY && !UNSPLASH_KEY) throw new Error("No image provider keys configured");

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

    // Build dedup sets across all places (paginated to bypass 1000-row limit)
    const usedPexels = new Set<string>();
    const usedUnsplash = new Set<string>();
    const PAGE = 1000;
    let from = 0;
    while (true) {
      const { data: rows } = await supabase
        .from("places")
        .select("id, image")
        .not("image", "is", null)
        .range(from, from + PAGE - 1);
      const list = rows || [];
      for (const r of list) {
        if (r.id === place.id) continue;
        const url = (r.image as string) || "";
        const px = extractPexelsId(url);
        if (px) usedPexels.add(px);
        const us = extractUnsplashId(url);
        if (us) usedUnsplash.add(us);
      }
      if (list.length < PAGE) break;
      from += PAGE;
    }

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

    const allCandidates: Candidate[] = [];

    // ---- Pexels ----
    if (PEXELS_KEY) {
      for (const query of queries) {
        const url = new URL("https://api.pexels.com/v1/search");
        url.searchParams.set("query", query);
        url.searchParams.set("per_page", "40");
        url.searchParams.set("orientation", "portrait");
        url.searchParams.set("size", "large");
        const resp = await fetch(url.toString(), { headers: { Authorization: PEXELS_KEY } });
        if (!resp.ok) continue;
        const data = await resp.json();
        const results: any[] = data.photos || [];
        for (const p of results) {
          const pid = String(p.id);
          if (usedPexels.has(pid)) continue;
          const alt = (p.alt || "").toLowerCase();
          if (HUMAN_RE.test(alt)) continue;
          let score = 30; // small base bonus for Pexels portrait match
          for (const w of WIDE_HINTS) if (alt.includes(w)) score += 50;
          for (const w of NARROW_PENALTIES) if (alt.includes(w)) score -= 80;
          if (p.height && p.width && p.height / p.width > 1.2) score += 10;
          const imgUrl = p.src?.portrait || p.src?.large;
          if (!imgUrl) continue;
          allCandidates.push({
            provider: "pexels",
            id: pid,
            url: imgUrl,
            score,
            photographer: p.photographer,
          });
        }
        if (allCandidates.length > 30) break; // enough Pexels candidates
      }
    }

    // ---- Unsplash ----
    if (UNSPLASH_KEY) {
      for (const query of queries) {
        const url = new URL("https://api.unsplash.com/search/photos");
        url.searchParams.set("query", query);
        url.searchParams.set("per_page", "30");
        url.searchParams.set("order_by", "relevant");
        url.searchParams.set("content_filter", "high");
        url.searchParams.set("orientation", "portrait");
        const resp = await fetch(url.toString(), {
          headers: { Authorization: `Client-ID ${UNSPLASH_KEY}`, "Accept-Version": "v1" },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const results: any[] = data.results || [];
        for (const p of results) {
          if (usedUnsplash.has(p.id)) continue;
          const desc = `${p.description || ""} ${p.alt_description || ""}`.toLowerCase();
          if (/\b(selfie|portrait of|wedding|bride|groom)\b/.test(desc)) continue;
          const tags = [...(p.tags || []), ...(p.tags_preview || [])]
            .map((t: any) => (t?.title || "").toLowerCase());
          const text = `${desc} ${tags.join(" ")}`;
          let score = (p.likes || 0);
          for (const w of WIDE_HINTS) if (text.includes(w)) score += 50;
          for (const w of NARROW_PENALTIES) if (text.includes(w)) score -= 80;
          const baseUrl = p.urls?.raw || p.urls?.full;
          if (!baseUrl) continue;
          const imgUrl = `${baseUrl}&w=900&h=1200&fit=crop&crop=entropy&q=80&fm=jpg`;
          allCandidates.push({
            provider: "unsplash",
            id: p.id,
            url: imgUrl,
            score,
            photographer: p.user?.name,
            downloadLocation: p.links?.download_location,
          });
        }
        if (allCandidates.length > 60) break;
      }
    }

    if (allCandidates.length === 0) throw new Error("No suitable photos found");

    allCandidates.sort((a, b) => b.score - a.score);
    const chosen = allCandidates[0];

    // Trigger Unsplash download tracking if applicable
    if (chosen.provider === "unsplash" && chosen.downloadLocation && UNSPLASH_KEY) {
      fetch(chosen.downloadLocation, {
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
      }).catch(() => {});
    }

    await supabase.from("places").update({ image: chosen.url }).eq("id", place.id);

    return new Response(
      JSON.stringify({
        image_url: chosen.url,
        provider: chosen.provider,
        photo_id: chosen.id,
        photographer: chosen.photographer,
        score: chosen.score,
        candidates: allCandidates.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-best-poster error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
