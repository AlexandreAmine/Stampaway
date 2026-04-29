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
function extractWikiId(url: string): string | null {
  // wikimedia upload URLs include the filename
  const m = url.match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

const HUMAN_RE = /\b(selfie|portrait of|wedding|bride|groom|model posing|couple posing)\b/i;
const WIDE_HINTS = [
  "skyline","cityscape","aerial","panorama","panoramic","city","downtown",
  "drone","overview","view","harbour","harbor","bay","coast","old town",
  "rooftops","square","plaza","canal","bridge","river","medina","kasbah",
  "souk","minaret","ribat",
];
const NARROW_PENALTIES = [
  "close-up","closeup","macro","interior","inside","facade","detail",
  "door","window","sign","statue","sculpture","food","plate","menu",
  "person","selfie","portrait","map","diagram","logo","coat of arms","flag",
];

type Candidate = {
  provider: "pexels" | "unsplash" | "wikipedia";
  id: string;
  url: string;
  score: number;
  photographer?: string;
  downloadLocation?: string;
};

async function fetchWikipediaImages(name: string, country: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const titles = [`${name}`, `${name}, ${country}`, `${name} (city)`];
  for (const title of titles) {
    try {
      // Use MediaWiki API to get page images (main + on-page)
      const u = new URL("https://en.wikipedia.org/w/api.php");
      u.searchParams.set("action", "query");
      u.searchParams.set("format", "json");
      u.searchParams.set("origin", "*");
      u.searchParams.set("titles", title);
      u.searchParams.set("prop", "pageimages|images");
      u.searchParams.set("piprop", "original");
      u.searchParams.set("imlimit", "30");
      u.searchParams.set("redirects", "1");
      const r = await fetch(u.toString(), { headers: { "User-Agent": "StampAway/1.0 (poster fetcher)" } });
      if (!r.ok) continue;
      const j = await r.json();
      const pages = j?.query?.pages || {};
      for (const pid of Object.keys(pages)) {
        const page = pages[pid];
        if (!page) continue;
        const collected: { file: string; isMain: boolean }[] = [];
        if (page.original?.source) {
          const fname = decodeURIComponent(page.original.source.split("/").pop() || "");
          collected.push({ file: `File:${fname}`, isMain: true });
        }
        for (const im of page.images || []) {
          const t = im.title as string;
          if (!t) continue;
          if (!/\.(jpe?g|png)$/i.test(t)) continue;
          if (/(coat[_ ]of[_ ]arms|flag|map|locator|seal|emblem|logo|svg)/i.test(t)) continue;
          collected.push({ file: t, isMain: false });
        }
        if (collected.length === 0) continue;
        // Get imageinfo (URL + metadata) in batch
        const fileTitles = collected.slice(0, 30).map((c) => c.file).join("|");
        const u2 = new URL("https://en.wikipedia.org/w/api.php");
        u2.searchParams.set("action", "query");
        u2.searchParams.set("format", "json");
        u2.searchParams.set("origin", "*");
        u2.searchParams.set("titles", fileTitles);
        u2.searchParams.set("prop", "imageinfo");
        u2.searchParams.set("iiprop", "url|size|extmetadata");
        u2.searchParams.set("iiurlwidth", "1200");
        const r2 = await fetch(u2.toString(), { headers: { "User-Agent": "StampAway/1.0 (poster fetcher)" } });
        if (!r2.ok) continue;
        const j2 = await r2.json();
        const filePages = j2?.query?.pages || {};
        for (const fpid of Object.keys(filePages)) {
          const fp = filePages[fpid];
          const info = fp?.imageinfo?.[0];
          if (!info) continue;
          const url = info.thumburl || info.url;
          if (!url) continue;
          const w = info.thumbwidth || info.width || 0;
          const h = info.thumbheight || info.height || 0;
          if (w < 600 || h < 400) continue;
          const meta = info.extmetadata || {};
          const desc = `${meta.ImageDescription?.value || ""} ${meta.ObjectName?.value || ""} ${fp.title || ""}`
            .replace(/<[^>]+>/g, " ").toLowerCase();
          if (HUMAN_RE.test(desc)) continue;
          if (/(coat of arms|flag of|map of|locator|seal of|logo)/i.test(desc)) continue;
          const isMain = collected.find((c) => c.file === fp.title)?.isMain;
          let score = isMain ? 120 : 40;
          for (const w2 of WIDE_HINTS) if (desc.includes(w2)) score += 50;
          for (const w2 of NARROW_PENALTIES) if (desc.includes(w2)) score -= 80;
          // Prefer landscape that we crop to portrait, and large originals
          if (w >= 1000) score += 20;
          out.push({
            provider: "wikipedia",
            id: fp.title || url,
            url,
            score,
            photographer: meta.Artist?.value?.replace(/<[^>]+>/g, "").trim(),
          });
        }
        if (out.length > 0) break;
      }
      if (out.length > 0) break;
    } catch (_) { /* ignore */ }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { place_id, force, beach_boost } = await req.json();
    if (!place_id) throw new Error("place_id is required");
    const BEACH_HINTS = ["beach","beaches","ocean","sea","caribbean","turquoise","sand","palm","coast","bay","lagoon","reef","tropical","shore"];
    const beachBoost = !!beach_boost;

    const PEXELS_KEY = Deno.env.get("PEXELS_API_KEY")?.trim();
    const UNSPLASH_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY")?.trim();

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
    const usedWiki = new Set<string>();
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
        const wk = extractWikiId(url);
        if (wk) usedWiki.add(wk);
      }
      if (list.length < PAGE) break;
      from += PAGE;
    }

    const baseCityQueries = [
      `${place.name} ${place.country} aerial cityscape skyline`,
      `${place.name} ${place.country} city skyline panorama`,
      `${place.name} ${place.country} cityscape`,
      `${place.name} ${place.country} city`,
      `${place.name} ${place.country}`,
      `${place.name} skyline`,
      `${place.name}`,
    ];
    const beachQueries = [
      `${place.name} ${place.country} beach`,
      `${place.name} beach`,
      `${place.name} ${place.country} coast aerial`,
      `${place.name} ${place.country} caribbean`,
    ];
    const queries =
      place.type === "city"
        ? (beachBoost ? [...beachQueries, ...baseCityQueries] : baseCityQueries)
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
          let score = 30;
          for (const w of WIDE_HINTS) if (alt.includes(w)) score += 50;
          for (const w of NARROW_PENALTIES) if (alt.includes(w)) score -= 80;
          if (beachBoost) for (const w of BEACH_HINTS) if (alt.includes(w)) score += 60;
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
        if (allCandidates.length > 30) break;
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
          if (beachBoost) for (const w of BEACH_HINTS) if (text.includes(w)) score += 60;
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

    // ---- Wikipedia ----
    try {
      const wikiCands = await fetchWikipediaImages(place.name, place.country);
      for (const c of wikiCands) {
        if (usedWiki.has(c.id)) continue;
        allCandidates.push(c);
      }
    } catch (e) {
      console.error("wiki fetch failed", e);
    }

    if (allCandidates.length === 0) throw new Error("No suitable photos found");

    allCandidates.sort((a, b) => b.score - a.score);
    const chosen = allCandidates[0];

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
