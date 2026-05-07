import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORTED = new Set(["en", "fr", "es", "it", "pt", "nl"]);

async function generateEnglishFacts(city_name: string, country_name: string): Promise<any> {
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
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableApiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!aiResponse.ok) {
    if (aiResponse.status === 429) throw new Error("rate_limit");
    if (aiResponse.status === 402) throw new Error("credits_exhausted");
    throw new Error(`AI API error: ${aiResponse.status}`);
  }
  const aiData = await aiResponse.json();
  let factsText = aiData.choices?.[0]?.message?.content || "";
  factsText = factsText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(factsText);
}

async function translateFacts(facts: any, language: string, supabase: any): Promise<any> {
  if (language === "en") return facts;

  // Collect all translatable strings in a stable order
  const items: string[] = [];
  const push = (s: any) => { items.push(typeof s === "string" ? s : String(s ?? "")); };

  facts.fun_facts?.forEach(push);
  push(facts.famous_dish || "");
  facts.city_records?.forEach(push);
  facts.avg_weather_by_month?.forEach((m: any) => push(m.month));
  facts.most_touristic_months?.forEach(push);
  facts.least_touristic_months?.forEach(push);

  const { data, error } = await supabase.functions.invoke("translate-deepl", {
    body: { texts: items, language },
  });
  if (error) throw error;
  const t: string[] = data?.translations || items;

  let i = 0;
  const out: any = { ...facts };
  out.fun_facts = (facts.fun_facts || []).map(() => t[i++]);
  out.famous_dish = t[i++];
  out.city_records = (facts.city_records || []).map(() => t[i++]);
  out.avg_weather_by_month = (facts.avg_weather_by_month || []).map((m: any) => ({
    ...m,
    month: t[i++],
  }));
  out.most_touristic_months = (facts.most_touristic_months || []).map(() => t[i++]);
  out.least_touristic_months = (facts.least_touristic_months || []).map(() => t[i++]);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { city_name, country_name, language: rawLang } = await req.json();
    const language = SUPPORTED.has(rawLang) ? rawLang : "en";

    if (!city_name || !country_name) {
      return new Response(JSON.stringify({ error: "city_name and country_name required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cache: requested language
    const { data: cached } = await supabase
      .from("city_facts")
      .select("facts")
      .eq("city_name", city_name)
      .eq("country_name", country_name)
      .eq("language", language)
      .maybeSingle();
    if (cached) {
      return new Response(JSON.stringify(cached.facts),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get or generate English baseline
    let englishFacts: any;
    const { data: enCached } = await supabase
      .from("city_facts")
      .select("facts")
      .eq("city_name", city_name)
      .eq("country_name", country_name)
      .eq("language", "en")
      .maybeSingle();
    if (enCached) {
      englishFacts = enCached.facts;
    } else {
      englishFacts = await generateEnglishFacts(city_name, country_name);
      await supabase.from("city_facts").upsert(
        { city_name, country_name, language: "en", facts: englishFacts },
        { onConflict: "city_name,country_name,language" },
      );
    }

    if (language === "en") {
      return new Response(JSON.stringify(englishFacts),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const translated = await translateFacts(englishFacts, language, supabase);
    await supabase.from("city_facts").upsert(
      { city_name, country_name, language, facts: translated },
      { onConflict: "city_name,country_name,language" },
    );

    return new Response(JSON.stringify(translated),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const msg = (error as Error).message;
    console.error("get-city-facts error:", msg);
    if (msg === "rate_limit") {
      return new Response(JSON.stringify({ error: "Rate limit reached, please try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (msg === "credits_exhausted") {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
