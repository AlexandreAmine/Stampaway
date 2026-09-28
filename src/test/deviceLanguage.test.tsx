import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

const h = vi.hoisted(() => ({
  native: false,
  deviceCode: "en" as string,
  deviceThrows: false,
}));

vi.mock("@/lib/native/platform", () => ({ isNative: () => h.native }));
vi.mock("@capacitor/device", () => ({
  Device: {
    getLanguageCode: vi.fn(async () => {
      if (h.deviceThrows) throw new Error("unavailable");
      return { value: h.deviceCode };
    }),
  },
}));
// The DOM translator is irrelevant here and would start a MutationObserver.
vi.mock("@/lib/domTranslator", () => ({
  startDomTranslator: vi.fn(),
  setDomTranslatorLanguage: vi.fn(),
  addNoTranslateStrings: vi.fn(),
  addNoTranslateTemplates: vi.fn(),
}));

import {
  toSupportedLanguage,
  readInitialLanguage,
  detectDeviceLanguage,
} from "@/lib/deviceLanguage";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { addNoTranslateStrings } from "@/lib/domTranslator";
import { translations } from "@/i18n/translations";

function setNavigatorLanguages(list: string[]) {
  Object.defineProperty(window.navigator, "languages", { value: list, configurable: true });
  Object.defineProperty(window.navigator, "language", { value: list[0], configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  h.native = false;
  h.deviceCode = "en";
  h.deviceThrows = false;
  setNavigatorLanguages(["en-US"]);
});

describe("toSupportedLanguage", () => {
  it("reduces region tags to a supported base language", () => {
    expect(toSupportedLanguage("fr-FR")).toBe("fr");
    expect(toSupportedLanguage("pt_BR")).toBe("pt");
    expect(toSupportedLanguage("NL")).toBe("nl");
  });

  it("rejects unsupported and empty values", () => {
    expect(toSupportedLanguage("de-DE")).toBeNull();
    expect(toSupportedLanguage("")).toBeNull();
    expect(toSupportedLanguage(null)).toBeNull();
  });
});

describe("readInitialLanguage", () => {
  it("prefers a language chosen in Settings over everything else", () => {
    localStorage.setItem("app_language", "it");
    localStorage.setItem("app_language_detected", "fr");
    setNavigatorLanguages(["es-ES"]);
    expect(readInitialLanguage()).toBe("it");
  });

  it("then the last detected device language, so relaunches don't flash English", () => {
    localStorage.setItem("app_language_detected", "fr");
    setNavigatorLanguages(["es-ES"]);
    expect(readInitialLanguage()).toBe("fr");
  });

  it("then the first supported browser language", () => {
    setNavigatorLanguages(["de-DE", "nl-NL", "en-US"]);
    expect(readInitialLanguage()).toBe("nl");
  });

  it("falls back to English", () => {
    setNavigatorLanguages(["de-DE", "ja-JP"]);
    expect(readInitialLanguage()).toBe("en");
  });

  it("ignores a corrupt stored value", () => {
    localStorage.setItem("app_language", "klingon");
    expect(readInitialLanguage()).toBe("en");
  });
});

describe("detectDeviceLanguage", () => {
  it("asks iOS directly on native", async () => {
    h.native = true;
    h.deviceCode = "fr";
    setNavigatorLanguages(["en-US"]); // the web view can report the bundle's English
    expect(await detectDeviceLanguage()).toBe("fr");
  });

  it("falls back to the web view when the device language is unsupported", async () => {
    h.native = true;
    h.deviceCode = "de";
    setNavigatorLanguages(["es-ES"]);
    expect(await detectDeviceLanguage()).toBe("es");
  });

  it("falls back to the web view when the native call fails", async () => {
    h.native = true;
    h.deviceThrows = true;
    setNavigatorLanguages(["it-IT"]);
    expect(await detectDeviceLanguage()).toBe("it");
  });

  it("uses the browser list on web", async () => {
    setNavigatorLanguages(["pt-BR"]);
    expect(await detectDeviceLanguage()).toBe("pt");
  });
});

function Probe() {
  const { language, setLanguage } = useLanguage();
  return (
    <>
      <span data-testid="lang">{language}</span>
      <button onClick={() => setLanguage("es")}>choose-es</button>
    </>
  );
}

describe("LanguageProvider", () => {
  it("switches to the device language when none was chosen", async () => {
    h.native = true;
    h.deviceCode = "fr";
    render(<LanguageProvider><Probe /></LanguageProvider>);
    await waitFor(() => expect(screen.getByTestId("lang").textContent).toBe("fr"));
    expect(localStorage.getItem("app_language_detected")).toBe("fr");
  });

  it("does not persist a detected language as the user's choice", async () => {
    h.native = true;
    h.deviceCode = "fr";
    render(<LanguageProvider><Probe /></LanguageProvider>);
    await waitFor(() => expect(screen.getByTestId("lang").textContent).toBe("fr"));
    expect(localStorage.getItem("app_language")).toBeNull();
  });

  it("never overrides a language chosen in Settings", async () => {
    localStorage.setItem("app_language", "it");
    h.native = true;
    h.deviceCode = "fr";
    render(<LanguageProvider><Probe /></LanguageProvider>);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("lang").textContent).toBe("it");
  });

  it("keeps the runtime translator away from strings that are already translated", async () => {
    h.native = true;
    h.deviceCode = "fr";
    render(<LanguageProvider><Probe /></LanguageProvider>);
    await waitFor(() => expect(screen.getByTestId("lang").textContent).toBe("fr"));
    const seeded = new Set(vi.mocked(addNoTranslateStrings).mock.calls.flatMap((c) => [...c[0]]));
    // Hand-written French — including its deliberate non-breaking space — must
    // never be sent to DeepL and replaced.
    expect(seeded.has(translations.fr["home.followFriends"])).toBe(true);
    expect(translations.fr["home.followFriends"]).toContain(" !");
    // English must stay translatable, or hardcoded "Save" would slip through.
    expect(seeded.has(translations.en["save"])).toBe(false);
  });

  it("persists a choice made in Settings", async () => {
    render(<LanguageProvider><Probe /></LanguageProvider>);
    await act(async () => {
      screen.getByText("choose-es").click();
    });
    expect(screen.getByTestId("lang").textContent).toBe("es");
    expect(localStorage.getItem("app_language")).toBe("es");
  });
});
