import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

const h = vi.hoisted(() => ({
  places: [] as { id: string; type: string; name: string }[],
  reviews: [] as { place_id: string; user_id: string; rating: number | null }[],
  calls: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const visitorCounts = () => {
    const m = new Map<string, Set<string>>();
    h.reviews.forEach((r) => (m.get(r.place_id) ?? m.set(r.place_id, new Set()).get(r.place_id)!).add(r.user_id));
    return [...m].map(([place_id, s]) => ({ place_id, visitor_count: s.size }));
  };
  const avgRatings = () => {
    const m = new Map<string, number[]>();
    h.reviews.filter((r) => r.rating != null).forEach((r) => (m.get(r.place_id) ?? m.set(r.place_id, []).get(r.place_id)!).push(r.rating!));
    return [...m].map(([place_id, rs]) => ({ place_id, avg_rating: rs.reduce((a, b) => a + b, 0) / rs.length }));
  };
  const from = (table: string) => {
    h.calls.push(`from:${table}`);
    const q: any = {
      select: () => q,
      eq: () => q,
      range: async () => ({ data: table === "places" ? h.places : [], error: null }),
      maybeSingle: async () => ({ data: { facts: { population: "10", fun_facts: [], country_records: [], famous_celebrities: [], avg_weather_by_month: [], most_touristic_months: [], least_touristic_months: [] } }, error: null }),
    };
    return q;
  };
  const rpc = async (name: string) => {
    h.calls.push(`rpc:${name}`);
    if (name === "get_place_visitor_counts") return { data: visitorCounts(), error: null };
    if (name === "get_place_avg_ratings") return { data: avgRatings(), error: null };
    return { data: [], error: null };
  };
  return { supabase: { from, rpc, functions: { invoke: async () => { h.calls.push("fn"); return { data: null, error: null }; } } } };
});

import { clearRankingsCache, fetchPlaceRanks } from "@/lib/placeRankings";
import { createPersistentCache } from "@/lib/persistentCache";

/** The calculation the facts sections used to do on raw review rows. */
function oldRanks(placeId: string, type: string) {
  const ofType = h.places.filter((p) => p.type === type);
  const visitors = new Map<string, Set<string>>();
  const ratings = new Map<string, number[]>();
  h.reviews.forEach((r) => {
    (visitors.get(r.place_id) ?? visitors.set(r.place_id, new Set()).get(r.place_id)!).add(r.user_id);
    if (r.rating != null) (ratings.get(r.place_id) ?? ratings.set(r.place_id, []).get(r.place_id)!).push(r.rating);
  });
  const v = ofType.map((c) => ({ id: c.id, count: visitors.get(c.id)?.size || 0 })).sort((a, b) => b.count - a.count);
  const r = ofType
    .map((c) => { const rs = ratings.get(c.id) || []; return { id: c.id, avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0 }; })
    .filter((c) => c.avg > 0)
    .sort((a, b) => b.avg - a.avg);
  const vi = v.findIndex((c) => c.id === placeId);
  const ri = r.findIndex((c) => c.id === placeId);
  return { visitorRank: vi >= 0 ? vi + 1 : null, ratingRank: ri >= 0 ? ri + 1 : null };
}

beforeEach(() => {
  localStorage.clear();
  clearRankingsCache();
  h.calls = [];
  // Distinct visitor counts and averages, so no ties make the order arbitrary.
  h.places = [
    { id: "fr", type: "country", name: "France" },
    { id: "pt", type: "country", name: "Portugal" },
    { id: "es", type: "country", name: "Spain" },
    { id: "is", type: "country", name: "Iceland" },
    { id: "paris", type: "city", name: "Paris" },
  ];
  h.reviews = [
    ...["a", "b", "c", "d"].map((u, i) => ({ place_id: "fr", user_id: u, rating: 3 + i * 0.1 })),
    { place_id: "fr", user_id: "a", rating: 2 }, // a revisit: still one visitor
    ...["a", "b", "c"].map((u) => ({ place_id: "pt", user_id: u, rating: 4.5 })),
    ...["a", "b"].map((u) => ({ place_id: "es", user_id: u, rating: null })),
    { place_id: "paris", user_id: "a", rating: 5 },
  ];
});

describe("fetchPlaceRanks", () => {
  it("gives the same ranks as the old row-by-row calculation", async () => {
    for (const id of ["fr", "pt", "es", "is"]) {
      expect(await fetchPlaceRanks(id, "country")).toEqual(oldRanks(id, "country"));
    }
    expect(await fetchPlaceRanks("paris", "city")).toEqual(oldRanks("paris", "city"));
  });

  it("never downloads review rows", async () => {
    await fetchPlaceRanks("fr", "country");
    expect(h.calls).not.toContain("from:reviews");
  });
});

describe("createPersistentCache", () => {
  it("keeps values across reloads until they expire", () => {
    vi.useFakeTimers();
    const a = createPersistentCache<string>("t1", { maxEntries: 5, ttlMs: 1000 });
    a.set("k", "v");
    const b = createPersistentCache<string>("t1", { maxEntries: 5, ttlMs: 1000 }); // a "relaunch"
    expect(b.get("k")).toBe("v");
    vi.advanceTimersByTime(1500);
    expect(b.get("k")).toBeUndefined();
    vi.useRealTimers();
  });

  it("keeps only the most recently used entries", () => {
    vi.useFakeTimers();
    const c = createPersistentCache<number>("t2", { maxEntries: 2, ttlMs: 60_000 });
    c.set("one", 1);
    vi.advanceTimersByTime(10);
    c.set("two", 2);
    vi.advanceTimersByTime(10);
    c.get("one"); // used again
    vi.advanceTimersByTime(10);
    c.set("three", 3);
    expect(c.get("one")).toBe(1);
    expect(c.get("two")).toBeUndefined();
    expect(c.get("three")).toBe(3);
    vi.useRealTimers();
  });
});

describe("CountryFacts", () => {
  it("a second visit shows the facts without asking the server", async () => {
    const { CountryFacts } = await import("@/components/CountryFacts");
    const { LanguageProvider } = await import("@/contexts/LanguageContext");
    const view = () =>
      render(
        <LanguageProvider>
          <CountryFacts countryName="France" placeId="fr" />
        </LanguageProvider>
      );
    const first = view();
    await act(async () => {});
    expect(h.calls).toContain("from:country_facts");
    first.unmount();

    h.calls = [];
    view();
    await act(async () => {});
    expect(h.calls).not.toContain("from:country_facts");
    expect(h.calls).not.toContain("fn");
    expect(screen.getByText("10")).toBeTruthy();
  });
});
