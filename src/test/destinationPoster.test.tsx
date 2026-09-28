import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/native/platform", () => ({ isNative: () => false }));
vi.mock("@/lib/domTranslator", () => ({
  startDomTranslator: vi.fn(),
  setDomTranslatorLanguage: vi.fn(),
  addNoTranslateStrings: vi.fn(),
  addNoTranslateTemplates: vi.fn(),
}));

import { DestinationPoster } from "@/components/DestinationPoster";
import { RecentSearches } from "@/components/RecentSearches";
import { LanguageProvider } from "@/contexts/LanguageContext";

const wrap = (ui: React.ReactNode) => render(<LanguageProvider>{ui}</LanguageProvider>);
const photo = (container: HTMLElement) =>
  [...container.querySelectorAll("img")].find((img) => img.src.includes("example.com"))!;
const flagImgs = (container: HTMLElement) =>
  [...container.querySelectorAll("img")].filter((img) => img.src.includes("/flags/"));

beforeEach(() => localStorage.setItem("app_language", "en"));

describe("DestinationPoster", () => {
  it("shows a large flag card when there is no photo", () => {
    const { container } = wrap(
      <DestinationPoster placeId="p1" name="Germany" country="Germany" type="country" image={null} />,
    );
    const flags = flagImgs(container);
    // Only the large fallback flag, not the small corner one as well.
    expect(flags).toHaveLength(1);
    expect(flags[0].src).toContain("/flags/w160/de.png");
    expect(screen.getByText("Germany")).toBeTruthy();
  });

  it("switches to the flag card when the photo fails to load", () => {
    const { container } = wrap(
      <DestinationPoster placeId="p2" name="Germany" country="Germany" type="country" image="https://example.com/broken.jpg" />,
    );
    expect(flagImgs(container)[0].src).toContain("/flags/w80/de.png");
    fireEvent.error(photo(container));
    expect(flagImgs(container)[0].src).toContain("/flags/w160/de.png");
  });

  it("shimmers until the photo loads, then stops", () => {
    const { container } = wrap(
      <DestinationPoster placeId="p3" name="Italy" country="Italy" type="country" image="https://example.com/italy.jpg" />,
    );
    expect(container.querySelector(".skeleton-shimmer")).not.toBeNull();
    fireEvent.load(photo(container));
    expect(container.querySelector(".skeleton-shimmer")).toBeNull();
  });

  it("keeps a flag invisible until it loads, and removes it if it fails", () => {
    const { container } = wrap(
      <DestinationPoster placeId="p4" name="Italy" country="Italy" type="country" image="https://example.com/italy.jpg" />,
    );
    const flag = flagImgs(container)[0];
    expect(flag.className).toContain("opacity-0");
    fireEvent.load(flag);
    expect(flag.className).toContain("opacity-100");
    fireEvent.error(flag);
    expect(flagImgs(container)).toHaveLength(0);
  });
});

describe("RecentSearches", () => {
  it("shows name, flag and country, and tolerates old id+name entries", () => {
    const onSelect = vi.fn();
    wrap(
      <RecentSearches
        places={[
          { id: "c1", name: "Lisbon", country: "Portugal", type: "city", image: null },
          { id: "k1", name: "Spain", country: "Spain", type: "country", image: null },
          { id: "old", name: "Tokyo" },
        ]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByText("Lisbon")).toBeTruthy();
    expect(screen.getByText("Portugal")).toBeTruthy();
    expect(screen.getByText("Country")).toBeTruthy();
    fireEvent.click(screen.getByText("Tokyo"));
    expect(onSelect).toHaveBeenCalledWith({ id: "old", name: "Tokyo" });
  });

  it("uses the app language for place names", () => {
    localStorage.setItem("app_language", "fr");
    wrap(<RecentSearches places={[{ id: "k1", name: "Spain", country: "Spain", type: "country" }]} onSelect={vi.fn()} />);
    expect(screen.getByText("Espagne")).toBeTruthy();
    expect(screen.getByText("Pays")).toBeTruthy();
  });
});

describe("CountryFlag", () => {
  it("renders the same flag image as the posters, or nothing for an unknown country", async () => {
    const { CountryFlag } = await import("@/components/CountryFlag");
    const { container, rerender } = render(<CountryFlag country="Japan" />);
    expect(flagImgs(container)[0].src).toContain("/flags/w80/jp.png");
    rerender(<CountryFlag country="Atlantis" />);
    expect(flagImgs(container)).toHaveLength(0);
  });
});
