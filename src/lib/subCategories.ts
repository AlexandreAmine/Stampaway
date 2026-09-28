import type { TranslationKey } from "@/i18n/translations";

/**
 * The eight sub-rating categories, in display order.
 *
 * These exact strings are what `review_sub_ratings.category` stores, so they
 * are data, not copy — never translate or rename them. Display text comes from
 * the label maps below instead.
 */
export const SUB_CATEGORIES = [
  "Affordability",
  "Natural Beauty",
  "Culture & Heritage",
  "Safety & Security",
  "Food",
  "Hospitality & People",
  "Weather",
  "Entertainment & Nightlife",
] as const;

export type SubCategory = (typeof SUB_CATEGORIES)[number];

const LABEL_KEYS: Record<SubCategory, TranslationKey> = {
  Affordability: "cat.affordability",
  "Natural Beauty": "cat.naturalBeauty",
  "Culture & Heritage": "cat.cultureHeritage",
  "Safety & Security": "cat.safetySecurity",
  Food: "cat.food",
  "Hospitality & People": "cat.hospitality",
  Weather: "cat.weather",
  "Entertainment & Nightlife": "cat.nightlife",
};

const SHORT_LABEL_KEYS: Record<SubCategory, TranslationKey> = {
  Affordability: "cat.short.affordability",
  "Natural Beauty": "cat.short.naturalBeauty",
  "Culture & Heritage": "cat.short.cultureHeritage",
  "Safety & Security": "cat.short.safetySecurity",
  Food: "cat.short.food",
  "Hospitality & People": "cat.short.hospitality",
  Weather: "cat.short.weather",
  "Entertainment & Nightlife": "cat.short.nightlife",
};

type Translate = (key: TranslationKey) => string;

function isSubCategory(value: string): value is SubCategory {
  return (SUB_CATEGORIES as readonly string[]).includes(value);
}

/** Localized label for a stored category. Unknown values pass through as-is. */
export function subCategoryLabel(category: string, t: Translate): string {
  return isSubCategory(category) ? t(LABEL_KEYS[category]) : category;
}

/** Compact label for tight layouts, e.g. the review card summary. */
export function subCategoryShortLabel(category: string, t: Translate): string {
  return isSubCategory(category) ? t(SHORT_LABEL_KEYS[category]) : category;
}
