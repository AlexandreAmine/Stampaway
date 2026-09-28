import type { TranslationKey } from "@/i18n/translations";

export type DestSort = "your-highest" | "category-highest" | "avg-highest" | "avg-category-highest" | "newest" | "longest";

type T = (key: TranslationKey, replacements?: Record<string, string>) => string;

/** Sort menu labels for a profile's destinations; `name` is set on someone else's profile. */
export function destSortLabels(t: T, name?: string): Record<DestSort, string> {
  const username = name ?? "";
  return {
    "your-highest": name ? t("sort.usernameHighest", { username }) : t("sort.yourHighest"),
    "category-highest": name ? t("sort.usernameCatHighest", { username }) : t("sort.yourCatHighest"),
    "avg-highest": t("sort.avgHighest"),
    "avg-category-highest": t("sort.avgCatHighest"),
    "newest": name ? t("sort.usernameNewest", { username }) : t("sort.newestVisited"),
    "longest": name ? t("sort.usernameLongest", { username }) : t("sort.highestDuration"),
  };
}
