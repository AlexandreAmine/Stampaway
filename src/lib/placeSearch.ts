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

// Searching runs over the whole catalog on every keystroke; place names are
// the same each time, so each is normalized once.
const normalizedNames = new Map<string, string>();
function normalizedName(name: string): string {
  let normalized = normalizedNames.get(name);
  if (normalized === undefined) {
    normalized = normalizeSearchText(name);
    if (normalizedNames.size > 50_000) normalizedNames.clear();
    normalizedNames.set(name, normalized);
  }
  return normalized;
}

export function matchesPlaceName(
  place: { name: string; type?: string },
  normalizedQuery: string,
  language: Language
): boolean {
  if (!normalizedQuery) return true;
  if (normalizedName(place.name).includes(normalizedQuery)) return true;
  if (language === "en") return false;

  const localized = getCachedPlaceName(place.name, language, place.type === "country");
  return localized !== place.name && normalizedName(localized).includes(normalizedQuery);
}

/**
 * Country picker search (Edit Profile). Countries are stored under their
 * English name but matched in the app language too, so "Allemagne" finds
 * Germany, accent-insensitively. Names that start with the query come
 * first, then alphabetical by the name the user sees. Returns English names.
 */
export function searchCountryNames(
  countries: readonly string[],
  query: string,
  exclude: readonly string[],
  language: Language,
  limit = 8,
): string[] {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return [];
  const rank = (label: string) => (normalizeSearchText(label).startsWith(normalizedQuery) ? 0 : 1);
  return countries
    .filter((c) => !exclude.includes(c) && matchesPlaceName({ name: c, type: "country" }, normalizedQuery, language))
    .map((c) => ({ c, label: getCachedPlaceName(c, language, true) }))
    .sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, language))
    .slice(0, limit)
    .map(({ c }) => c);
}
