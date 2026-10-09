import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/native/platform", () => ({ isNative: () => false }));

import { shouldTranslate, addNoTranslateTemplates } from "@/lib/domTranslator";
import { continentLabel } from "@/lib/continentLabels";
import { destSortLabels } from "@/lib/sortLabels";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { translations, type TranslationKey } from "@/i18n/translations";

const tFor = (lang: keyof typeof translations) => (key: TranslationKey, r?: Record<string, string>) => {
  let text = translations[lang][key];
  Object.entries(r ?? {}).forEach(([k, v]) => (text = text.replace(`{${k}}`, v)));
  return text;
};

describe("DOM translator templates", () => {
  it("leaves already-translated sentences with names filled in alone", () => {
    addNoTranslateTemplates(["En réponse à {username}", "Top {limit} des pays {region}"]);
    expect(shouldTranslate("En réponse à alice")).toBe(false);
    expect(shouldTranslate("Top 20 des pays d'Europe")).toBe(false);
  });

  it("still translates English that merely resembles a template", () => {
    addNoTranslateTemplates(["En réponse à {username}"]);
    expect(shouldTranslate("Replying to alice")).toBe(true);
  });

  it("ignores templates that are almost all placeholder", () => {
    addNoTranslateTemplates(["{count} ×"]);
    expect(shouldTranslate("Some English text ×")).toBe(true);
  });

  it("treats regex characters in templates literally", () => {
    addNoTranslateTemplates(["Voir plus ({count})"]);
    expect(shouldTranslate("Voir plus (12)")).toBe(false);
    expect(shouldTranslate("Voir plusX12)")).toBe(true);
  });
});

describe("continentLabel", () => {
  it("translates the English group keys and falls back to the key", () => {
    expect(continentLabel("North America", tFor("fr"))).toBe("Amérique du Nord");
    expect(continentLabel("Other", tFor("es"))).toBe("Otro");
    expect(continentLabel("Atlantis", tFor("fr"))).toBe("Atlantis");
  });
});

describe("destSortLabels", () => {
  it("keeps the English labels", () => {
    expect(destSortLabels(tFor("en"))["newest"]).toBe("Newest visited first");
    expect(destSortLabels(tFor("en"), "alice")["longest"]).toBe("alice's highest total duration first");
  });

  it("puts the name into the translated label", () => {
    expect(destSortLabels(tFor("fr"), "alice")["newest"]).toBe("Visites les plus récentes de alice");
  });
});

function Plural({ n }: { n: number }) {
  const { tn } = useLanguage();
  return <span data-testid="p">{tn("count.city", n)}</span>;
}

describe("tn", () => {
  it("picks the plural form for the count", () => {
    localStorage.setItem("app_language", "en");
    const { rerender } = render(<LanguageProvider><Plural n={1} /></LanguageProvider>);
    expect(screen.getByTestId("p").textContent).toBe("1 city");
    rerender(<LanguageProvider><Plural n={3} /></LanguageProvider>);
    expect(screen.getByTestId("p").textContent).toBe("3 cities");
  });

  it("follows the language's own plural rules (French 0 is singular)", () => {
    localStorage.setItem("app_language", "fr");
    render(<LanguageProvider><Plural n={0} /></LanguageProvider>);
    expect(screen.getByTestId("p").textContent).toBe("0 ville");
  });
});

describe("shouldTranslate remembered answers", () => {
  it("a text added to the no-translate list afterwards is no longer translated", async () => {
    const { shouldTranslate, addNoTranslateStrings } = await import("@/lib/domTranslator");
    expect(shouldTranslate("Zzyzx Road")).toBe(true);
    addNoTranslateStrings(["Zzyzx Road"]);
    expect(shouldTranslate("Zzyzx Road")).toBe(false);
  });

  it("a template added afterwards covers texts already checked", async () => {
    const { shouldTranslate, addNoTranslateTemplates } = await import("@/lib/domTranslator");
    expect(shouldTranslate("Qqqq vers alice")).toBe(true);
    addNoTranslateTemplates(["Qqqq vers {username}"]);
    expect(shouldTranslate("Qqqq vers alice")).toBe(false);
  });
});
