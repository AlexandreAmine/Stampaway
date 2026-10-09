import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildSuggestions,
  detectHomeCountry,
  groupByCountry,
  isLikelyVisit,
  suggestedVisitDate,
  type CountryVisits,
} from "@/lib/photoTrips";
import { loadCountryShapes, makeCountryLocator } from "@/lib/countryShapes";

const visits = (alpha2: string, days: string[], photos = days.length * 3): CountryVisits => ({ alpha2, days, photos });

describe("suggestedVisitDate", () => {
  it("one month of photos: that month", () => {
    expect(suggestedVisitDate(["2023-05-02", "2023-05-03", "2023-05-07"])).toEqual({ year: 2023, month: 5 });
  });

  it("two months back to back (a trip over a month's end): the month with more days", () => {
    expect(suggestedVisitDate(["2023-05-30", "2023-05-31", "2023-06-01"])).toEqual({ year: 2023, month: 5 });
    expect(suggestedVisitDate(["2023-05-31", "2023-06-01", "2023-06-02"])).toEqual({ year: 2023, month: 6 });
  });

  it("back to back across new year", () => {
    expect(suggestedVisitDate(["2023-12-30", "2023-12-31", "2024-01-01"])).toEqual({ year: 2023, month: 12 });
  });

  it("a tie picks the earlier month", () => {
    expect(suggestedVisitDate(["2023-05-31", "2023-06-01"])).toEqual({ year: 2023, month: 5 });
  });

  it("months further apart mean several visits: no date", () => {
    expect(suggestedVisitDate(["2022-06-10", "2024-08-03"])).toBeNull();
    expect(suggestedVisitDate(["2023-05-10", "2023-07-10"])).toBeNull();
    expect(suggestedVisitDate(["2023-05-31", "2023-06-01", "2023-07-01"])).toBeNull();
  });

  it("no days: no date", () => {
    expect(suggestedVisitDate([])).toBeNull();
  });
});

describe("isLikelyVisit", () => {
  it("drops a lone photo or two from a single day", () => {
    expect(isLikelyVisit(visits("PT", ["2023-05-01"], 1))).toBe(false);
    expect(isLikelyVisit(visits("PT", ["2023-05-01"], 2))).toBe(false);
  });
  it("keeps three photos, or two different days", () => {
    expect(isLikelyVisit(visits("PT", ["2023-05-01"], 3))).toBe(true);
    expect(isLikelyVisit(visits("PT", ["2023-05-01", "2023-05-02"], 2))).toBe(true);
  });
});

describe("detectHomeCountry", () => {
  const days = (n: number) => Array.from({ length: n }, (_, i) => `2023-01-${String(i + 1).padStart(2, "0")}`);
  it("the country with far more days of photos than any other", () => {
    expect(detectHomeCountry([visits("FR", days(30)), visits("PT", days(6))])).toBe("FR");
  });
  it("nobody stands out: none", () => {
    expect(detectHomeCountry([visits("FR", days(20)), visits("PT", days(12))])).toBeNull();
    expect(detectHomeCountry([visits("FR", days(10))])).toBeNull();
  });
});

describe("buildSuggestions", () => {
  it("leaves out home, already-logged and unlikely countries; most recent first; dates per rule", () => {
    const all = new Map<string, CountryVisits>([
      ["FR", visits("FR", ["2024-01-01", "2024-01-02"])],
      ["PT", visits("PT", ["2023-05-02", "2023-05-03"])],
      ["ES", visits("ES", ["2022-06-10", "2024-08-03"])],
      ["IT", visits("IT", ["2021-04-01", "2021-04-02"])],
      ["MA", visits("MA", ["2020-01-01"], 1)],
    ]);
    const result = buildSuggestions(all, { home: "FR", alreadyLogged: new Set(["IT"]) });
    expect(result.map((s) => s.alpha2)).toEqual(["ES", "PT"]);
    expect(result[0].suggestedDate).toBeNull();
    expect(result[1].suggestedDate).toEqual({ year: 2023, month: 5 });
  });
});

describe("country lookup", () => {
  let locate: (lat: number, lng: number) => string | null;
  beforeAll(async () => {
    const topology = JSON.parse(readFileSync(join(__dirname, "../../public/countries-50m.json"), "utf8"));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => topology })));
    locate = makeCountryLocator(await loadCountryShapes());
  });

  it("finds big and small countries", () => {
    expect(locate(38.7, -9.1)).toBe("PT"); // Lisbon
    expect(locate(48.9, 2.3)).toBe("FR"); // Paris
    expect(locate(43.74, 7.42)).toBe("MC"); // Monaco
    expect(locate(1.3, 103.8)).toBe("SG"); // Singapore
    expect(locate(35.9, 14.5)).toBe("MT"); // Malta
  });

  it("territories count toward their country", () => {
    expect(locate(18.4, -66.1)).toBe("US"); // San Juan, Puerto Rico
    expect(locate(22.3, 114.2)).toBe("CN"); // Hong Kong
    expect(locate(-17.5, -149.6)).toBe("FR"); // Tahiti
  });

  it("works on both sides of the antimeridian", () => {
    expect(locate(-17.8, 178.0)).toBe("FJ"); // Viti Levu
    expect(locate(-16.7, -179.9)).toBe("FJ"); // Taveuni, east of 180°
  });

  it("is fast enough for a big library", () => {
    const start = performance.now();
    for (let i = 0; i < 20000; i++) locate(40 + (i % 100) / 100, 2 + Math.floor(i / 100) / 100);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("a point just off the coast takes the nearby country; open sea is nothing", () => {
    expect(locate(36.5, -4.9)).toBe("ES"); // Marbella shore
    expect(locate(30.0, -40.0)).toBeNull(); // mid-Atlantic
  });

  it("groups photo cells by country", () => {
    const grouped = groupByCountry(
      [
        { lat: 38.7, lng: -9.1, day: "2023-05-02", count: 4 },
        { lat: 38.7, lng: -9.1, day: "2023-05-03", count: 2 },
        { lat: 48.9, lng: 2.3, day: "2024-01-01", count: 1 },
        { lat: 30.0, lng: -40.0, day: "2024-01-01", count: 9 },
      ],
      locate
    );
    expect([...grouped.keys()].sort()).toEqual(["FR", "PT"]);
    expect(grouped.get("PT")).toEqual({ alpha2: "PT", photos: 6, days: ["2023-05-02", "2023-05-03"] });
  });
});
