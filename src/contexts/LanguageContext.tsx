import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { translations, Language, TranslationKey } from "@/i18n/translations";
import { startDomTranslator, setDomTranslatorLanguage, addNoTranslateStrings } from "@/lib/domTranslator";
import { getAllLocalizedPlaceNames } from "@/lib/placeNames";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, replacements?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem("app_language") as Language) || "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app_language", lang);
    setDomTranslatorLanguage(lang);
  };

  useEffect(() => {
    // Seed all known place names (English + localized variants) into the
    // do-not-translate registry so DeepL never mistranslates "Riga" -> "chemise".
    const seed: string[] = [];
    (["en","fr","es","it","pt","nl"] as Language[]).forEach((l) => {
      seed.push(...getAllLocalizedPlaceNames(l));
    });
    addNoTranslateStrings(seed);
    // Start the DOM-level auto-translator once mounted
    startDomTranslator(language);
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
