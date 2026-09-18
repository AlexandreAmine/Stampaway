import { describe, it, expect } from "vitest";
import {
  EUROPE_COUNTRIES,
  ASIA_COUNTRIES,
  NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA_COUNTRIES,
  AFRICA_COUNTRIES,
  OCEANIA_COUNTRIES,
  SOUTHEAST_ASIA_COUNTRIES,
  CARIBBEAN_COUNTRIES,
  EASTERN_EUROPE_COUNTRIES,
  MIDDLE_EAST_COUNTRIES,
  NAMED_REGIONS,
} from "@/lib/continents";

// These lists are matched against place.country strings coming from the
// database, so a typo or a missing entry silently drops places out of Explore
// sections rather than failing loudly. These tests guard the shape of the data.

const MAIN_CONTINENTS = {
  EUROPE: EUROPE_COUNTRIES,
  ASIA: ASIA_COUNTRIES,
  NORTH_AMERICA: NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA: SOUTH_AMERICA_COUNTRIES,
  AFRICA: AFRICA_COUNTRIES,
  OCEANIA: OCEANIA_COUNTRIES,
} as const;

const SUB_REGIONS = {
  SOUTHEAST_ASIA: SOUTHEAST_ASIA_COUNTRIES,
  CARIBBEAN: CARIBBEAN_COUNTRIES,
  EASTERN_EUROPE: EASTERN_EUROPE_COUNTRIES,
  MIDDLE_EAST: MIDDLE_EAST_COUNTRIES,
} as const;

const ALL_LISTS = { ...MAIN_CONTINENTS, ...SUB_REGIONS };

// "Timor-Leste" appears in SOUTHEAST_ASIA but ASIA spells it "East Timor".
// SOUTHEAST_ASIA carries both spellings defensively; ASIA carries only one.
// Pinned so a NEW unmatched country is caught, rather than hidden behind this one.
const KNOWN_UNMATCHED_SUBREGION_COUNTRIES = ["Timor-Leste"];

describe("continent lists", () => {
  it("are all non-empty", () => {
    for (const [name, list] of Object.entries(ALL_LISTS)) {
      expect(list.length, name).toBeGreaterThan(0);
    }
  });

  it("contain no duplicate entries within a single list", () => {
    for (const [name, list] of Object.entries(ALL_LISTS)) {
      const duplicates = list.filter((c, i) => list.indexOf(c) !== i);
      expect(duplicates, `${name} has duplicates`).toEqual([]);
    }
  });

  it("contain no empty or untrimmed country names", () => {
    for (const [name, list] of Object.entries(ALL_LISTS)) {
      for (const country of list) {
        expect(country, name).toBe(country.trim());
        expect(country.length, name).toBeGreaterThan(0);
      }
    }
  });

  it("keep the six main continents mutually exclusive", () => {
    const names = Object.keys(MAIN_CONTINENTS) as (keyof typeof MAIN_CONTINENTS)[];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const overlap = MAIN_CONTINENTS[names[i]].filter((c) =>
          (MAIN_CONTINENTS[names[j]] as readonly string[]).includes(c)
        );
        expect(overlap, `${names[i]} overlaps ${names[j]}`).toEqual([]);
      }
    }
  });

  it("resolve every sub-region country to a main continent", () => {
    const allMain = new Set(Object.values(MAIN_CONTINENTS).flat());
    for (const [name, list] of Object.entries(SUB_REGIONS)) {
      const unmatched = list
        .filter((c) => !allMain.has(c))
        .filter((c) => !KNOWN_UNMATCHED_SUBREGION_COUNTRIES.includes(c));
      expect(unmatched, `${name} has countries in no main continent`).toEqual([]);
    }
  });
});

describe("NAMED_REGIONS", () => {
  it("points every key at a non-empty list", () => {
    for (const [region, list] of Object.entries(NAMED_REGIONS)) {
      expect(Array.isArray(list), region).toBe(true);
      expect(list.length, region).toBeGreaterThan(0);
    }
  });

  it("reuses the exported sub-region arrays rather than copying them", () => {
    expect(NAMED_REGIONS["Southeast Asia"]).toBe(SOUTHEAST_ASIA_COUNTRIES);
    expect(NAMED_REGIONS["Caribbean"]).toBe(CARIBBEAN_COUNTRIES);
    expect(NAMED_REGIONS["Eastern Europe"]).toBe(EASTERN_EUROPE_COUNTRIES);
    expect(NAMED_REGIONS["Middle East"]).toBe(MIDDLE_EAST_COUNTRIES);
  });

  it("exposes exactly the four regions Explore links to", () => {
    expect(Object.keys(NAMED_REGIONS).sort()).toEqual([
      "Caribbean",
      "Eastern Europe",
      "Middle East",
      "Southeast Asia",
    ]);
  });
});
