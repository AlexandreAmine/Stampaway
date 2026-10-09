import { formatDistanceToNow, type Locale } from "date-fns";
import { es, fr, it, nl, ptBR } from "date-fns/locale";
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

export function localeFor(language: Language): string {
  return LOCALES[language];
}

// Intl formatters are slow to create and feeds format a date per row, so
// each one is built once and reused.
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();
function relativeFormat(language: Language, numeric: "auto" | "always", style: "narrow" | "short") {
  const key = `${language}|${numeric}|${style}`;
  let format = relativeFormats.get(key);
  if (!format) {
    format = new Intl.RelativeTimeFormat(LOCALES[language], { numeric, style });
    relativeFormats.set(key, format);
  }
  return format;
}

/**
 * Coarse "how long ago" used by feeds and comments: today, yesterday, then
 * days, weeks and months ("3d ago", "il y a 3 j"). English keeps the compact
 * narrow style; other languages use the short style, since narrow French
 * reads as "-3 j".
 */
export function relativeDays(dateStr: string, language: Language, now: Date = new Date()): string {
  const diffDays = Math.floor((now.getTime() - new Date(dateStr).getTime()) / 86400000);
  const style = language === "en" ? "narrow" : "short";
  // "auto" only for days ("today", "yesterday"); for weeks and months it
  // would turn 1 into "last wk." instead of "1w ago".
  const days = relativeFormat(language, "auto", style);
  const other = relativeFormat(language, "always", style);
  if (diffDays < 7) return days.format(-Math.max(0, diffDays), "day");
  if (diffDays < 30) return other.format(-Math.floor(diffDays / 7), "week");
  return other.format(-Math.floor(diffDays / 30), "month");
}

const DATE_FNS_LOCALES: Partial<Record<Language, Locale>> = { fr, es, it, pt: ptBR, nl };

/** "5 minutes ago" / "il y a 5 minutes". English drops the leading "about". */
export function timeAgo(date: string | Date, language: Language): string {
  const text = formatDistanceToNow(new Date(date), { addSuffix: true, locale: DATE_FNS_LOCALES[language] });
  return language === "en" ? text.replace(/^about /, "") : text;
}

/** A calendar date in the app language, e.g. "3/14/2025" or "14/03/2025". */
export function shortDate(date: Date, language: Language): string {
  return date.toLocaleDateString(LOCALES[language]);
}

/** Short month names, January first, e.g. ["Jan", "Feb", …] or ["janv.", "févr.", …]. */
const monthNamesCache = new Map<Language, string[]>();
export function monthShortNames(language: Language): string[] {
  const cached = monthNamesCache.get(language);
  if (cached) return cached;
  const format = new Intl.DateTimeFormat(LOCALES[language], { month: "short" });
  // Day 15 keeps every month well clear of timezone-shift edge cases.
  const names = Array.from({ length: 12 }, (_, i) => format.format(new Date(2000, i, 15)));
  monthNamesCache.set(language, names);
  return names;
}
