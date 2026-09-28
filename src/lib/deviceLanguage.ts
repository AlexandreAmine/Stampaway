import { Device } from "@capacitor/device";
import { isNative } from "@/lib/native/platform";
import type { Language } from "@/i18n/translations";

/**
 * Which language to show, when the user hasn't chosen one.
 *
 * Only a choice made in Settings is stored as the user's language (EXPLICIT_KEY).
 * Until then the app follows the device, so changing the phone's language
 * later is reflected too. The last detected language is cached separately so
 * the next launch can render in it immediately instead of flashing English.
 */

export const EXPLICIT_KEY = "app_language";
const DETECTED_KEY = "app_language_detected";

const SUPPORTED: readonly Language[] = ["en", "fr", "es", "it", "pt", "nl"];

/** "fr-FR", "pt_BR", "NL" → a supported Language, or null. */
export function toSupportedLanguage(code: string | null | undefined): Language | null {
  const base = code?.trim().toLowerCase().split(/[-_]/)[0];
  return base && (SUPPORTED as readonly string[]).includes(base) ? (base as Language) : null;
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function hasExplicitLanguage(): boolean {
  return toSupportedLanguage(read(EXPLICIT_KEY)) !== null;
}

/** First supported language in the browser's preference list. */
function fromNavigator(): Language | null {
  if (typeof navigator === "undefined") return null;
  const list = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const code of list) {
    const lang = toSupportedLanguage(code);
    if (lang) return lang;
  }
  return null;
}

/** Best synchronous guess for the first render. */
export function readInitialLanguage(): Language {
  return (
    toSupportedLanguage(read(EXPLICIT_KEY)) ??
    toSupportedLanguage(read(DETECTED_KEY)) ??
    fromNavigator() ??
    "en"
  );
}

/**
 * The device's language, if supported. On iOS this asks the OS directly: the
 * web view can report the app's resolved localization instead, which is
 * English whenever the bundle declares only English.
 */
export async function detectDeviceLanguage(): Promise<Language | null> {
  if (isNative()) {
    try {
      const { value } = await Device.getLanguageCode();
      const lang = toSupportedLanguage(value);
      if (lang) return lang;
    } catch {
      // Fall through to the web view's answer.
    }
  }
  return fromNavigator();
}

export function rememberDetectedLanguage(lang: Language) {
  try {
    window.localStorage.setItem(DETECTED_KEY, lang);
  } catch {
    // Only a cache; detection simply runs again next launch.
  }
}
