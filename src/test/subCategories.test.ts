import { describe, it, expect } from "vitest";
import { SUB_CATEGORIES, subCategoryLabel, subCategoryShortLabel } from "@/lib/subCategories";
import { translations, type TranslationKey } from "@/i18n/translations";
import { monthShortNames } from "@/lib/localeFormat";

const tFor = (lang: keyof typeof translations) => (key: TranslationKey) => translations[lang][key];

describe("SUB_CATEGORIES", () => {
  // These strings are what review_sub_ratings.category stores. Changing one
  // would orphan every rating already saved under the old spelling, so this
  // pins them exactly — translate the labels, never these.
  it("keeps the exact stored category values", () => {
    expect([...SUB_CATEGORIES]).toEqual([
      "Affordability",
      "Natural Beauty",
      "Culture & Heritage",
      "Safety & Security",
      "Food",
      "Hospitality & People",
      "Weather",
      "Entertainment & Nightlife",
    ]);
  });
});

describe("subCategoryLabel", () => {
  it("returns the English label unchanged in English", () => {
    for (const cat of SUB_CATEGORIES) {
      expect(subCategoryLabel(cat, tFor("en"))).toBe(cat);
    }
  });

  it("translates every category in every language", () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const cat of SUB_CATEGORIES) {
        const label = subCategoryLabel(cat, tFor(lang));
        expect(label, `${lang}: ${cat}`).toBeTruthy();
        expect(label, `${lang}: ${cat} fell through to its key`).not.toMatch(/^cat\./);
      }
    }
  });

  it("actually translates rather than echoing English", () => {
    expect(subCategoryLabel("Weather", tFor("fr"))).toBe("Météo");
    expect(subCategoryLabel("Food", tFor("es"))).toBe("Gastronomía");
  });

  it("passes an unknown category through as-is", () => {
    expect(subCategoryLabel("Something Legacy", tFor("fr"))).toBe("Something Legacy");
  });
});

describe("subCategoryShortLabel", () => {
  it("has a compact label for every category in every language", () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const cat of SUB_CATEGORIES) {
        const short = subCategoryShortLabel(cat, tFor(lang));
        expect(short, `${lang}: ${cat}`).toBeTruthy();
        expect(short).not.toMatch(/^cat\./);
      }
    }
  });
});

describe("monthShortNames", () => {
  it("returns twelve names starting with January", () => {
    const en = monthShortNames("en");
    expect(en).toHaveLength(12);
    expect(en[0]).toBe("Jan");
    expect(en[11]).toBe("Dec");
  });

  it("localizes rather than returning English", () => {
    expect(monthShortNames("fr")[0]).not.toBe("Jan");
    expect(monthShortNames("es")[0].toLowerCase()).toContain("ene");
  });

  it("gives twelve distinct names in every language", () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      expect(new Set(monthShortNames(lang)).size, lang).toBe(12);
    }
  });
});
