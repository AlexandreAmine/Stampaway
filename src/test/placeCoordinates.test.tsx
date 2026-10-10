import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const h = vi.hoisted(() => ({
  native: true,
  answers: new Map<string, { found: boolean; lat?: number; lng?: number; retry?: boolean }>(),
  asked: [] as { query: string; countryCode?: string }[],
}));

vi.mock("@/lib/native/placeGeocoder", () => ({
  canGeocodePlaces: () => h.native,
  PlaceGeocoder: {
    geocode: async (o: { query: string; countryCode?: string }) => {
      h.asked.push(o);
      return h.answers.get(o.query) ?? { found: false, retry: false };
    },
  },
}));

const item = (name: string, country: string, type = "city") => ({ place_name: name, place_country: country, place_type: type });

async function load() {
  vi.resetModules();
  return import("@/lib/placeCoordinates");
}

beforeEach(() => {
  localStorage.clear();
  h.native = true;
  h.answers.clear();
  h.asked = [];
});

describe("useAccuratePositions", () => {
  it("moves a city onto where the phone finds it, and remembers it", async () => {
    h.answers.set("New York City, United States", { found: true, lat: 40.71, lng: -74.0 });
    const { useAccuratePositions } = await load();
    const items = [item("New York City", "United States")];
    const { result } = renderHook(() => useAccuratePositions(items));
    // Before the answer: the country's centre (not in the built-in list).
    expect(result.current[0].lat).toBeCloseTo(37.09, 1);
    await act(async () => {});
    expect(result.current[0]).toMatchObject({ lat: 40.71, lng: -74.0 });
    expect(h.asked).toEqual([{ query: "New York City, United States", countryCode: "US" }]);

    // A relaunch: known at once, not asked again.
    h.asked = [];
    const again = await load();
    const { result: second } = renderHook(() => again.useAccuratePositions(items));
    expect(second.current[0]).toMatchObject({ lat: 40.71, lng: -74.0 });
    await act(async () => {});
    expect(h.asked).toEqual([]);
  });

  it("countries stay at their centre and are never looked up", async () => {
    const { useAccuratePositions } = await load();
    const items = [item("France", "France", "country")];
    const { result } = renderHook(() => useAccuratePositions(items));
    await act(async () => {});
    expect(result.current).toHaveLength(1);
    expect(h.asked).toEqual([]);
  });

  it("a city the phone can't find is remembered as such; a failed lookup is retried later", async () => {
    h.answers.set("Retryville, France", { found: false, retry: true });
    const { useAccuratePositions } = await load();
    const items = [item("Nowhereville", "France"), item("Retryville", "France")];
    renderHook(() => useAccuratePositions(items));
    await act(async () => {});
    expect(h.asked.map((a) => a.query)).toEqual(["Nowhereville, France", "Retryville, France"]);

    h.asked = [];
    const again = await load();
    renderHook(() => again.useAccuratePositions(items));
    await act(async () => {});
    expect(h.asked.map((a) => a.query)).toEqual(["Retryville, France"]);
  });

  it("outside the iPhone app it uses the built-in list and country centres", async () => {
    h.native = false;
    const { useAccuratePositions } = await load();
    const items = [item("Paris", "France"), item("Tinyville", "France")];
    const { result } = renderHook(() => useAccuratePositions(items));
    await act(async () => {});
    expect(result.current[0]).toMatchObject({ lat: 48.8566, lng: 2.3522 });
    expect(result.current).toHaveLength(2);
    expect(h.asked).toEqual([]);
  });
});

describe("useCityPositions (profile map)", () => {
  it("a city not located yet is left off the map, then appears where the phone finds it", async () => {
    h.answers.set("Koh Samui, Thailand", { found: true, lat: 9.51, lng: 100.01 });
    const { useCityPositions } = await load();
    const cities = [{ name: "Koh Samui", country: "Thailand", placeId: "p1" }];
    const { result } = renderHook(() => useCityPositions(cities));
    // Never drawn at the country's centre while unknown.
    expect(result.current).toEqual([]);
    await act(async () => {});
    expect(result.current[0].coords).toEqual([9.51, 100.01]);
  });

  it("a same-name city ends up in its own country, not the built-in one", async () => {
    // The built-in list has London (UK); this log is London, Canada.
    h.answers.set("London, Canada", { found: true, lat: 42.98, lng: -81.25 });
    // Paris, Texas isn't found at all: it must not be drawn in France.
    h.answers.set("Paris, United States", { found: false, retry: false });
    const { useCityPositions } = await load();
    const cities = [
      { name: "London", country: "Canada", placeId: "p2" },
      { name: "Paris", country: "United States", placeId: "p3" },
    ];
    const { result } = renderHook(() => useCityPositions(cities));
    await act(async () => {});
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({ placeId: "p2", coords: [42.98, -81.25] });
  });
});
