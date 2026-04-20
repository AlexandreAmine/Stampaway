import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ensurePlaceNamesTranslated, getCachedPlaceName } from "@/lib/placeNames";

/**
 * Returns a localized version of a single place name.
 * Falls back to original until AI translation arrives.
 */
export function useLocalizedPlaceName(name: string | undefined | null, isCountry: boolean): string {
  const { language } = useLanguage();
  const initial = name ? getCachedPlaceName(name, language, isCountry) : "";
  const [out, setOut] = useState<string>(initial);

  useEffect(() => {
    if (!name) { setOut(""); return; }
    setOut(getCachedPlaceName(name, language, isCountry));
    if (language === "en") return;
    let cancelled = false;
    ensurePlaceNamesTranslated([name], language, isCountry).then((res) => {
      if (!cancelled) setOut(res[0] || name);
    });
    return () => { cancelled = true; };
  }, [name, language, isCountry]);

  return out;
}

/** Localized list — returns mapped array, updates after AI translates new entries. */
export function useLocalizedPlaceNames(names: string[], isCountry: boolean): string[] {
  const { language } = useLanguage();
  const initial = names.map((n) => getCachedPlaceName(n, language, isCountry));
  const [out, setOut] = useState<string[]>(initial);

  useEffect(() => {
    setOut(names.map((n) => getCachedPlaceName(n, language, isCountry)));
    if (language === "en" || names.length === 0) return;
    let cancelled = false;
    ensurePlaceNamesTranslated(names, language, isCountry).then((res) => {
      if (!cancelled) setOut(res);
    });
    return () => { cancelled = true; };
  }, [names.join("|"), language, isCountry]);

  return out;
}
