import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { translations, Language, TranslationKey } from "@/i18n/translations";
import { startDomTranslator, setDomTranslatorLanguage, addNoTranslateStrings } from "@/lib/domTranslator";
import { getAllLocalizedPlaceNames } from "@/lib/placeNames";
import {
  EXPLICIT_KEY,
  detectDeviceLanguage,
  hasExplicitLanguage,
  readInitialLanguage,
  rememberDetectedLanguage,
} from "@/lib/deviceLanguage";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, replacements?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Seed all known place names (English + localized variants) into the
// do-not-translate registry so DeepL never mistranslates "Riga" -> "chemise".
// Runs at most once, and only when the translator is actually needed.
let noTranslateSeeded = false;
function seedNoTranslateRegistry() {
  if (noTranslateSeeded) return;
  noTranslateSeeded = true;
  const seed: string[] = [];
  (["en","fr","es","it","pt","nl"] as Language[]).forEach((l) => {
    seed.push(...getAllLocalizedPlaceNames(l));
  });
  addNoTranslateStrings(seed);
}

// Text rendered through t() is already in the target language. Without this,
// the DOM translator can't tell it apart from hardcoded English and sends it
// to DeepL as well — paying for a French-to-French round trip whose output
// then REPLACES the hand-written translation (dropping deliberate details
// such as French non-breaking spaces). Only the active language's strings are
// registered: English ones must stay translatable, or a hardcoded "Save"
// would match en's "Save" and stop being translated.
const seededUiLanguages = new Set<Language>();
function seedTranslatedUiStrings(lang: Language) {
  if (lang === "en" || seededUiLanguages.has(lang)) return;
  seededUiLanguages.add(lang);
  addNoTranslateStrings(Object.values(translations[lang]));
}

// The translator's MutationObserver scans every DOM addition — pure overhead
// while the app is in English (translations are no-ops). Start it only when a
// non-English language is active; once started it stays on so language
// toggles keep working (known nodes are tracked across switches).
function ensureTranslatorStarted(lang: Language) {
  seedNoTranslateRegistry();
  seedTranslatedUiStrings(lang);
  startDomTranslator(lang);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);

  const applyLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (lang !== "en") ensureTranslatorStarted(lang);
    setDomTranslatorLanguage(lang);
  };

  // A choice made in Settings — the only thing persisted as the user's language.
  const setLanguage = (lang: Language) => {
    localStorage.setItem(EXPLICIT_KEY, lang);
    applyLanguage(lang);
  };

  useEffect(() => {
    if (language !== "en") ensureTranslatorStarted(language);

    // Until the user picks a language, follow the device's. This resolves in
    // milliseconds, while the splash screen is still up.
    if (hasExplicitLanguage()) return;
    let cancelled = false;
    detectDeviceLanguage().then((detected) => {
      if (cancelled || !detected || hasExplicitLanguage()) return;
      rememberDetectedLanguage(detected);
      if (detected !== language) applyLanguage(detected);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCallback((key: TranslationKey, replacements?: Record<string, string>): string => {
    let text = translations[language]?.[key] || translations.en[key] || key;
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
