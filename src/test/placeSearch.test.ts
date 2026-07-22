import { describe, expect, it } from "vitest";
import { matchesPlaceName, normalizeSearchText } from "@/lib/placeSearch";

const spain = { name: "Spain", type: "country" };
const usa = { name: "United States", type: "country" };
const germany = { name: "Germany", type: "country" };

const q = (text: string) => normalizeSearchText(text);

describe("localized place search", () => {
  it('matches "espag" -> Spain in French (the reported scenario)', () => {
    expect(matchesPlaceName(spain, q("espag"), "fr")).toBe(true);
  });

  it("still matches the English name in every language", () => {
    expect(matchesPlaceName(spain, q("spai"), "fr")).toBe(true);
    expect(matchesPlaceName(spain, q("spai"), "en")).toBe(true);
  });

  it("matches accent-insensitively (Etats -> États-Unis)", () => {
    expect(matchesPlaceName(usa, q("etats"), "fr")).toBe(true);
    expect(matchesPlaceName(usa, q("états"), "fr")).toBe(true);
  });

  it("matches other languages (Alemania -> Germany in Spanish)", () => {
    expect(matchesPlaceName(germany, q("alemania"), "es")).toBe(true);
    expect(matchesPlaceName(germany, q("duits"), "nl")).toBe(true); // Duitsland
  });

  it("does not match localized names of OTHER languages", () => {
    // "espagne" is French; in English mode only the DB name matches
    expect(matchesPlaceName(spain, q("espagne"), "en")).toBe(false);
  });

  it("rejects non-matching queries", () => {
    expect(matchesPlaceName(spain, q("italie"), "fr")).toBe(false);
  });

  it("empty query matches everything (browse mode)", () => {
    expect(matchesPlaceName(spain, q(""), "fr")).toBe(true);
  });
});
