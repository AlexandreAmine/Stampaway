import type { TranslationKey } from "@/i18n/translations";

// Group keys used by the "By continent" views. They stay English because
// they are also used for ordering; only the heading shown is translated.
const CONTINENT_KEYS: Record<string, TranslationKey> = {
  Europe: "continent.europe",
  Asia: "continent.asia",
  "North America": "continent.northAmerica",
  "South America": "continent.southAmerica",
  Africa: "continent.africa",
  Oceania: "continent.oceania",
  Other: "common.otherOption",
};

export function continentLabel(continent: string, t: (key: TranslationKey) => string): string {
  const key = CONTINENT_KEYS[continent];
  return key ? t(key) : continent;
}
