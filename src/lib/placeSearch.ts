import { Language } from "@/i18n/translations";
import { getCachedPlaceName } from "@/lib/placeNames";

/**
 * Localized place-name search matching.
 *
 * Users typing in their app language expect localized matches: in French,
 * "espag" must find "Espagne" (DB name "Spain"). The matcher checks the
 * query against BOTH the English database name and the localized name for
 * the active language, so English queries keep working in every language.
 *
 * Matching is case- and accent-insensitive on both sides ("etats" matches
 * "États-Unis"; "zuri" matches "Zürich"), which also improves matching for
 * English users on accented city names.
 *
 * Coverage note: countries are fully translated statically for all 6
 * languages; cities use the static map plus the AI-translation cache that
 * fills as names are displayed in the app.
 */

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    // Strip combining diacritical marks left by NFD decomposition
    .replace(/[\u0300-\u036f]/g, "");
}

export function matchesPlaceName(
  place: { name: string; type?: string },
  normalizedQuery: string,
  language: Language
): boolean {
  if (!normalizedQuery) return true;
  if (normalizeSearchText(place.name).includes(normalizedQuery)) return true;
  if (language === "en") return false;

  const localized = getCachedPlaceName(place.name, language, place.type === "country");
  return localized !== place.name && normalizeSearchText(localized).includes(normalizedQuery);
}
