import { describe, it, expect } from "vitest";
import { translations, type Language, type TranslationKey } from "@/i18n/translations";

const LANGS = Object.keys(translations) as Language[];
const KEYS = Object.keys(translations.en) as TranslationKey[];
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  it("has a non-empty string for every key in every language", () => {
    for (const lang of LANGS) {
      for (const key of KEYS) {
        expect(translations[lang][key]?.trim(), `${lang} ${key}`).toBeTruthy();
      }
    }
  });

  // A translation that drops or renames {username} would show a blank or a
  // literal "{username}" in that language only.
  it("uses the same placeholders as English in every language", () => {
    for (const key of KEYS) {
      const expected = placeholders(translations.en[key]);
      for (const lang of LANGS) {
        expect(placeholders(translations[lang][key]), `${lang} ${key}`).toEqual(expected);
      }
    }
  });

  it("defines both forms of every plural", () => {
    for (const key of KEYS) {
      if (key.endsWith(".one")) expect(KEYS, key).toContain(key.replace(/\.one$/, ".other"));
      if (key.endsWith(".other")) expect(KEYS, key).toContain(key.replace(/\.other$/, ".one"));
    }
  });

  it("uses a non-breaking space before French high punctuation", () => {
    for (const key of KEYS) {
      expect(translations.fr[key], key).not.toMatch(/ [!?;:]/);
    }
  });

  it("keeps the continent names fixed (es/it once showed 'Asunto'/'Oggetto' for Asia)", () => {
    expect(translations.es["continent.asia"]).toBe("Asia");
    expect(translations.it["continent.asia"]).toBe("Asia");
  });
});
