import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map our app language codes to DeepL target_lang codes
const DEEPL_LANG: Record<string, string> = {
  en: "EN-US",
  fr: "FR",
  es: "ES",
  it: "IT",
  pt: "PT-PT",
  nl: "NL",
};

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function callDeepL(texts: string[], targetLang: string, apiKey: string): Promise<string[]> {
  // DeepL accepts multiple `text` params per request. Try Pro then Free endpoint.
  const body = new URLSearchParams();
  for (const t of texts) body.append("text", t);
  body.set("target_lang", targetLang);
  body.set("preserve_formatting", "1");

  const endpoints = ["https://api.deepl.com/v2/translate", "https://api-free.deepl.com/v2/translate"];
  let lastErr = "";
  for (const url of endpoints) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (res.ok) {
      const data = await res.json();
      return (data.translations || []).map((t: any) => t.text as string);
    }
    const txt = await res.text();
    lastErr = `${res.status} ${txt}`;
    // Only fall through to the alternate endpoint if it's a "wrong endpoint" error
    if (!txt.includes("Wrong endpoint")) break;
  }
  throw new Error(`DeepL error: ${lastErr}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { texts, language: rawLang } = await req.json();
    const language = rawLang || "en";
    const targetLang = DEEPL_LANG[language];

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // English -> passthrough
    if (language === "en" || !targetLang) {
      return new Response(JSON.stringify({ translations: texts }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Compute hashes and look up cache
    const hashes = await Promise.all(texts.map((t: string) => sha256(t || "")));
    const { data: cached } = await supabase
      .from("translations_cache")
      .select("source_hash, translated_text")
      .in("source_hash", hashes)
      .eq("target_lang", language);

    const cacheMap = new Map<string, string>();
    (cached || []).forEach((r: any) => cacheMap.set(r.source_hash, r.translated_text));

    // Find indices that need translating
    const toTranslateIdx: number[] = [];
    const toTranslateText: string[] = [];
    texts.forEach((t: string, i: number) => {
      if (!t || !t.trim()) return;
      if (!cacheMap.has(hashes[i])) {
        toTranslateIdx.push(i);
        toTranslateText.push(t);
      }
    });

    if (toTranslateText.length > 0) {
      const apiKey = Deno.env.get("DEEPL_API_KEY")!;
      // DeepL allows up to 50 texts and 128KB per request — chunk to be safe
      const CHUNK = 40;
      const allTranslated: string[] = [];
      for (let i = 0; i < toTranslateText.length; i += CHUNK) {
        const slice = toTranslateText.slice(i, i + CHUNK);
        const out = await callDeepL(slice, targetLang, apiKey);
        allTranslated.push(...out);
      }

      // Persist to cache
      const rows = toTranslateIdx.map((idx, k) => ({
        source_hash: hashes[idx],
        target_lang: language,
        source_text: texts[idx],
        translated_text: allTranslated[k] ?? texts[idx],
      }));
      if (rows.length) {
        await supabase
          .from("translations_cache")
          .upsert(rows, { onConflict: "source_hash,target_lang" });
        rows.forEach((r) => cacheMap.set(r.source_hash, r.translated_text));
      }
    }

    const translations = texts.map((t: string, i: number) => {
      if (!t || !t.trim()) return t;
      return cacheMap.get(hashes[i]) ?? t;
    });

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("translate-deepl error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, translations: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
