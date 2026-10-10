import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildCitySuggestions, clusterCells, detectHome, groupByCity, type PhotoCell } from "@/lib/photoTrips";

const cell = (lat: number, lng: number, day: string, count = 1): PhotoCell => ({ lat, lng, day, count });
const inFrance = () => "FR";

async function freshLookups() {
  vi.resetModules();
  return import("@/lib/photoCities");
}

beforeEach(() => localStorage.clear());

describe("clusterCells", () => {
  it("groups photos ~10 km apart into one place, named where most days were spent", () => {
    const clusters = clusterCells(
      [
        cell(48.857, 2.352, "2023-05-01", 10), // central Paris, 2 days
        cell(48.857, 2.352, "2023-05-02", 4),
        cell(48.81, 2.39, "2023-05-03", 20), // a suburb, 1 day but more photos
        cell(43.7, 7.26, "2023-06-01", 5), // Nice: another place
      ],
      inFrance
    );
    expect(clusters).toHaveLength(2);
    const paris = clusters.find((c) => c.photos === 34)!;
    expect([paris.lat, paris.lng]).toEqual([48.857, 2.352]);
    expect(paris.days).toEqual(["2023-05-01", "2023-05-02", "2023-05-03"]);
  });

  it("keeps squares stable between scans (same key)", () => {
    const a = clusterCells([cell(41.39, 2.17, "2022-01-01")], () => "ES");
    const b = clusterCells([cell(41.395, 2.171, "2024-01-01")], () => "ES");
    expect(a[0].key).toBe(b[0].key);
  });

  it("leaves out photos outside any country", () => {
    expect(clusterCells([cell(0, -30, "2023-01-01")], () => null)).toEqual([]);
  });
});

describe("city suggestions", () => {
  it("adds up the squares of the same city and skips home, logged and one-off photos", () => {
    const clusters = clusterCells(
      [
        cell(48.857, 2.352, "2023-05-01", 3),
        cell(48.95, 2.35, "2023-05-02", 3), // other square, same city
        cell(43.7, 7.26, "2023-06-01", 1), // a single photo: not a visit
        cell(45.76, 4.83, "2021-03-10", 5), // Lyon, logged already
      ],
      inFrance
    );
    const cityOf = (c: { lat: number }) => (c.lat > 48 ? "paris" : c.lat > 45 ? "lyon" : "nice");
    const visits = groupByCity(clusters, cityOf as never);
    expect(visits.get("paris")).toMatchObject({ photos: 6, days: ["2023-05-01", "2023-05-02"] });
    const suggestions = buildCitySuggestions(visits, { home: null, alreadyLogged: new Set(["lyon"]) });
    expect(suggestions.map((s) => s.placeId)).toEqual(["paris"]);
    expect(suggestions[0].suggestedDate).toEqual({ year: 2023, month: 5 });
  });

  it("finds the home city with the same rule as the home country", () => {
    const days = (n: number, month: string) => Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
    expect(detectHome([{ id: "lisbon", days: days(20, "2024-01") }, { id: "porto", days: days(3, "2024-02") }])?.id).toBe("lisbon");
    expect(detectHome([{ id: "lisbon", days: days(20, "2024-01") }, { id: "porto", days: days(12, "2024-02") }])).toBeNull();
  });
});

describe("nameClusters", () => {
  const cluster = (key: string) => ({ key, alpha2: "FR", lat: 48.857, lng: 2.352, photos: 3, days: ["2023-05-01"] });

  it("asks once per place, and never again on a later scan", async () => {
    const { nameClusters } = await freshLookups();
    const reverseGeocode = vi.fn(async () => ({ found: true, names: ["Paris", "Paris", "Île-de-France"], countryCode: "FR" }));
    const first = await nameClusters([cluster("a")], { reverseGeocode });
    expect(first.names.get("a")?.names[0]).toBe("Paris");

    const later = await freshLookups();
    const again = vi.fn();
    const second = await later.nameClusters([cluster("a")], { reverseGeocode: again });
    expect(again).not.toHaveBeenCalled();
    expect(second.names.get("a")?.countryCode).toBe("FR");
  });

  it("waits and retries when Apple says later, then stops with what it found", async () => {
    const { nameClusters, RETRY_WAITS_MS } = await freshLookups();
    const waits: number[] = [];
    const reverseGeocode = vi
      .fn()
      .mockResolvedValueOnce({ found: true, names: ["Paris"], countryCode: "FR" })
      .mockResolvedValue({ found: false, retry: true });
    const result = await nameClusters([cluster("a"), cluster("b"), cluster("c")], {
      reverseGeocode,
      wait: async (ms) => waits.push(ms),
      concurrency: 1,
    });
    expect(result.complete).toBe(false);
    expect([...result.names.keys()]).toEqual(["a"]);
    expect(waits).toEqual(RETRY_WAITS_MS);
  });

  it("looks up a few places at once, and gives remembered answers first", async () => {
    const { nameClusters } = await freshLookups();
    // "a" was looked up on an earlier scan.
    await nameClusters([cluster("a")], { reverseGeocode: async () => ({ found: true, names: ["Paris"], countryCode: "FR" }) });

    let inFlight = 0;
    let most = 0;
    const order: string[] = [];
    const reverseGeocode = vi.fn(async () => {
      inFlight++;
      most = Math.max(most, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { found: true, names: ["Lyon"], countryCode: "FR" };
    });
    const result = await nameClusters(["a", "b", "c", "d", "e"].map(cluster), {
      reverseGeocode,
      onProgress: (_done, _named, c) => order.push(c.key),
    });
    expect(most).toBe(3);
    expect(order[0]).toBe("a");
    expect(result.complete).toBe(true);
    expect(result.names.size).toBe(5);
  });

  it("a place with no city is remembered as such", async () => {
    const { nameClusters } = await freshLookups();
    const reverseGeocode = vi.fn(async () => ({ found: false, retry: false }));
    await nameClusters([cluster("sea")], { reverseGeocode });
    const later = await freshLookups();
    const again = vi.fn();
    await later.nameClusters([cluster("sea")], { reverseGeocode: again });
    expect(again).not.toHaveBeenCalled();
  });
});

describe("makeCityMatcher", () => {
  it("matches the city in the right country, ignoring accents, falling back to the county", async () => {
    const { makeCityMatcher } = await freshLookups();
    const match = makeCityMatcher([
      { id: "valencia-es", name: "Valencia", country: "Spain" },
      { id: "valencia-ve", name: "Valencia", country: "Venezuela" },
      { id: "zurich", name: "Zürich", country: "Switzerland" },
      { id: "nyc", name: "New York", country: "United States" },
    ]);
    expect(match({ names: ["Valencia"], countryCode: "VE" })?.id).toBe("valencia-ve");
    expect(match({ names: ["Zurich"], countryCode: "CH" })?.id).toBe("zurich");
    expect(match({ names: ["Brooklyn", "New York"], countryCode: "US" })?.id).toBe("nyc");
    expect(match({ names: ["Nowhere"], countryCode: "FR" })).toBeNull();
  });
});

describe("makeNearbyCityFinder", () => {
  it("names photos near a known city centre in the same country without asking", async () => {
    const { makeNearbyCityFinder } = await freshLookups();
    const positions: Record<string, [number, number]> = {
      "Paris|France": [48.8566, 2.3522],
      "London|Canada": [42.98, -81.25],
    };
    const find = makeNearbyCityFinder(
      [
        { id: "paris", name: "Paris", country: "France" },
        { id: "london-ca", name: "London", country: "Canada" },
        { id: "nowhere", name: "Nowhere", country: "France" },
      ],
      (name, country) => positions[`${name}|${country}`] ?? null
    );
    const at = (alpha2: string, lat: number, lng: number) => ({ key: "k", alpha2, lat, lng, photos: 3, days: ["2023-01-01"] });
    expect(find(at("FR", 48.86, 2.34))?.id).toBe("paris"); // the Louvre
    expect(find(at("FR", 48.8, 2.13))).toBeNull(); // Versailles, ~17 km: looked up instead
    expect(find(at("GB", 42.98, -81.25))).toBeNull(); // wrong country
  });
});
