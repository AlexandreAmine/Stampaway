import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
};

/**
 * Translates short strings (place names, short descriptions) to a target language.
 * Body: { texts: string[], language: "en"|"fr"|"es"|"it"|"pt"|"nl", kind?: "name"|"description" }
 * Returns: { translations: string[] }  (same order, same length)
 *
 * If language === "en", returns texts unchanged.
 * Names are translated literally (e.g. "France" -> "Francia"); proper nouns without
 * a common localized form are kept as-is.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts, language: rawLang, kind = "name" } = await req.json();
    const language = (rawLang && LANGUAGE_NAMES[rawLang]) ? rawLang : "en";

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (language === "en") {
      return new Response(JSON.stringify({ translations: texts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const langName = LANGUAGE_NAMES[language];

    const sys =
      kind === "description"
        ? `You are a professional translator. Translate the following short travel descriptions to ${langName}. Keep the meaning and length similar. Return ONLY a JSON array of translated strings, in the same order, no extra commentary.`
        : `You are a professional translator. Translate the following place names (cities/countries) to ${langName} when a common localized form exists. If the name has no common localized form (most non-major cities, proper nouns), keep it unchanged. Return ONLY a JSON array of strings in the same order, no extra commentary.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: JSON.stringify(texts) },
        ],
        temperature: 0,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit", translations: texts }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let raw = aiData.choices?.[0]?.message?.content || "[]";
    raw = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let translations: string[];
    try {
      translations = JSON.parse(raw);
      if (!Array.isArray(translations)) throw new Error("not array");
    } catch {
      translations = texts;
    }
    // Normalize length
    if (translations.length !== texts.length) {
      translations = texts.map((t, i) => translations[i] || t);
    }

    return new Response(JSON.stringify({ translations }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("translate-text error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message, translations: [] }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
