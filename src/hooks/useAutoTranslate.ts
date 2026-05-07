import { useEffect, useState, useCallback, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import type { Language } from "@/i18n/translations";

/**
 * Generic runtime translator for arbitrary English strings.
 * - Uses DeepL via edge function `translate-deepl`
 * - Caches in localStorage by language+text
 * - Batches requests within a microtask
 * - Returns English while loading; auto-rerenders when translations arrive
 *
 * Use for static, app-authored strings (NOT user-generated content).
 */

const STORAGE_KEY = "stampaway_auto_t_v1";

type CacheMap = Record<string, string>; // key: `${lang}::${text}` -> translated

function loadCache(): CacheMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let memCache: CacheMap = loadCache();
let saveScheduled = false;
function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memCache));
    } catch {}
  }, 200);
}

// Pending batch
const pending = new Map<Language, Set<string>>(); // lang -> set of english texts
const subscribers = new Set<() => void>();
let flushScheduled = false;

function notifyAll() {
  subscribers.forEach((fn) => fn());
}

async function flushBatch() {
  flushScheduled = false;
  for (const [lang, set] of pending.entries()) {
    if (set.size === 0) continue;
    const texts = Array.from(set);
    set.clear();
    try {
      const { data, error } = await supabase.functions.invoke("translate-deepl", {
        body: { texts, language: lang },
      });
      if (error || !data?.translations) continue;
      const translations: string[] = data.translations;
      texts.forEach((src, i) => {
        const translated = translations[i] ?? src;
        memCache[`${lang}::${src}`] = translated;
      });
      scheduleSave();
      notifyAll();
    } catch {
      /* ignore */
    }
  }
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  // Small delay to coalesce many strings rendered in the same tick
  setTimeout(flushBatch, 30);
}

function enqueue(lang: Language, text: string) {
  if (!pending.has(lang)) pending.set(lang, new Set());
  pending.get(lang)!.add(text);
  scheduleFlush();
}

/**
 * Hook returning a `tr(english)` function. English strings pass through unchanged.
 */
export function useAutoTranslate() {
  const { language } = useLanguage();
  const [, force] = useState(0);
  const subRef = useRef<() => void>();

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subRef.current = fn;
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);

  const tr = useCallback(
    (text: string | null | undefined): string => {
      if (!text) return text ?? "";
      if (language === "en") return text;
      const key = `${language}::${text}`;
      const cached = memCache[key];
      if (cached) return cached;
      enqueue(language, text);
      return text; // fallback to English while loading
    },
    [language],
  );

  return tr;
}
