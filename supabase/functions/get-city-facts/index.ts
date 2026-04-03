import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city_name, country_name } = await req.json();
    if (!city_name || !country_name) {
      return new Response(JSON.stringify({ error: "city_name and country_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first
    const { data: cached } = await supabase
      .from("city_facts")
      .select("facts")
      .eq("city_name", city_name)
      .eq("country_name", country_name)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify(cached.facts), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate with AI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const prompt = `Give me factual information about the city "${city_name}" in ${country_name}. Return ONLY valid JSON with this exact structure, no markdown:
{
  "population": "number as string e.g. 2,161,000",
  "area_km2": "number as string e.g. 105.4",
  "fun_facts": ["fact 1", "fact 2", "fact 3"],
  "famous_dish": "name of the most famous local dish of this city",
  "city_records": ["world/national record 1", "record 2", "record 3"],
  "avg_weather_by_month": [
    {"month": "Jan", "avg_temp_c": 5},
    {"month": "Feb", "avg_temp_c": 6},
    {"month": "Mar", "avg_temp_c": 9},
    {"month": "Apr", "avg_temp_c": 12},
    {"month": "May", "avg_temp_c": 16},
    {"month": "Jun", "avg_temp_c": 20},
    {"month": "Jul", "avg_temp_c": 22},
    {"month": "Aug", "avg_temp_c": 22},
    {"month": "Sep", "avg_temp_c": 18},
    {"month": "Oct", "avg_temp_c": 14},
    {"month": "Nov", "avg_temp_c": 9},
    {"month": "Dec", "avg_temp_c": 6}
  ],
  "most_touristic_months": ["month1", "month2", "month3"],
  "least_touristic_months": ["month1", "month2", "month3"]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let factsText = aiData.choices?.[0]?.message?.content || "";
    factsText = factsText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const facts = JSON.parse(factsText);

    // Cache in DB
    await supabase.from("city_facts").upsert(
      { city_name, country_name, facts },
      { onConflict: "city_name,country_name" }
    );

    return new Response(JSON.stringify(facts), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
