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
    const { place_id } = await req.json();
    if (!place_id) throw new Error("place_id is required");

    const UNSPLASH_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY");
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
    if (place.image) {
      return new Response(JSON.stringify({ image_url: place.image }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build query: prefer "<city> <country> skyline/landmark"; portrait orientation
    const query =
      place.type === "city"
        ? `${place.name} ${place.country} cityscape landmark`
        : `${place.name} landscape landmark`;

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
      throw new Error(`Unsplash failed: ${resp.status}`);
    }

    const data = await resp.json();
    const results: any[] = data.results || [];
    if (results.length === 0) throw new Error("No photos found");

    // Filter: no humans. Unsplash tags include things like "person", "people",
    // "man", "woman", "human", "face", "portrait", "selfie", "crowd".
    const HUMAN_TAGS = new Set([
      "person", "people", "man", "woman", "human", "face",
      "portrait", "selfie", "crowd", "boy", "girl", "kid",
      "child", "model", "wedding",
    ]);

    const noHumans = results.filter((p) => {
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

    const candidates = noHumans.length > 0 ? noHumans : results;

    // Pick the most popular (most likes)
    candidates.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    const chosen = candidates[0];

    // Use a portrait crop sized for poster frames (3:4)
    const baseUrl = chosen.urls?.raw || chosen.urls?.full;
    if (!baseUrl) throw new Error("No image URL");
    const imageUrl = `${baseUrl}&w=900&h=1200&fit=crop&crop=entropy&q=80&fm=jpg`;

    // Trigger Unsplash download tracking (required by API guidelines)
    if (chosen.links?.download_location) {
      fetch(chosen.links.download_location, {
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
      }).catch(() => {});
    }

    // Cache on the place
    await supabase
      .from("places")
      .update({ image: imageUrl })
      .eq("id", place.id);

    return new Response(
      JSON.stringify({
        image_url: imageUrl,
        photographer: chosen.user?.name,
        photographer_url: chosen.user?.links?.html,
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
