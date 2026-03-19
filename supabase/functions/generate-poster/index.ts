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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get place details
    const { data: place, error: placeError } = await supabase
      .from("places")
      .select("id, name, country, type, image")
      .eq("id", place_id)
      .single();

    if (placeError || !place) throw new Error("Place not found");

    // Return cached image if exists
    if (place.image) {
      return new Response(JSON.stringify({ image_url: place.image }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate poster image via Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt =
      place.type === "city"
        ? `A stunning cinematic travel poster photograph of ${place.name}, ${place.country}. Beautiful iconic cityscape or landmark, golden hour warm lighting, dramatic composition, professional travel photography. Vibrant colors. No text, no watermarks, no borders.`
        : `A stunning cinematic travel poster photograph representing ${place.name}. Beautiful iconic national landscape, landmark, or scenery. Golden hour warm lighting, dramatic composition, professional travel photography. Vibrant colors. No text, no watermarks, no borders.`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const imageDataUrl =
      aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageDataUrl) throw new Error("No image returned from AI");

    // Extract base64 data
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to storage
    const fileName = `${place.id}.png`;
    const { error: uploadError } = await supabase.storage
      .from("place-posters")
      .upload(fileName, bytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("place-posters")
      .getPublicUrl(fileName);

    const imageUrl = urlData.publicUrl;

    // Cache the URL in the places table
    await supabase
      .from("places")
      .update({ image: imageUrl })
      .eq("id", place.id);

    return new Response(JSON.stringify({ image_url: imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-poster error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
