import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Translates an array of short strings (place names, descriptions) to a target
 * language using the translate-deepl edge function (cached).
 * Body: { texts: string[], language: "en"|"fr"|"es"|"it"|"pt"|"nl", kind?: "name"|"description" }
 * Returns: { translations: string[] }
 *
 * Backwards-compatible wrapper around translate-deepl.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts, language: rawLang } = await req.json();
    const language = rawLang || "en";

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (language === "en") {
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.functions.invoke("translate-deepl", {
      body: { texts, language },
    });
    if (error) throw error;

    return new Response(JSON.stringify({ translations: data?.translations || texts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("translate-text error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, translations: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
