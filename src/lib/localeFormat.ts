import type { Language } from "@/i18n/translations";

// Portuguese copy in this app is Brazilian, so month names follow suit.
const LOCALES: Record<Language, string> = {
  en: "en",
  fr: "fr",
  es: "es",
  it: "it",
  pt: "pt-BR",
  nl: "nl",
};

/** Short month names, January first, e.g. ["Jan", "Feb", …] or ["janv.", "févr.", …]. */
export function monthShortNames(language: Language): string[] {
  const format = new Intl.DateTimeFormat(LOCALES[language], { month: "short" });
  // Day 15 keeps every month well clear of timezone-shift edge cases.
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(2000, i, 15)));
}
