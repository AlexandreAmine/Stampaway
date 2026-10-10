import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const h = vi.hoisted(() => ({
  inserts: [] as { table: string; row: any }[],
  scan: vi.fn(),
}));

vi.mock("@/lib/native/photoTrips", () => ({
  canFindCountriesInPhotos: () => true,
  PhotoTrips: {
    checkAccess: async () => ({ access: "granted" }),
    requestAccess: async () => ({ access: "granted" }),
    scan: h.scan,
    openSettings: async () => {},
  },
}));
vi.mock("@/lib/placeRankings", () => ({
  clearRankingsCache: () => {},
  fetchAllPlaces: async () => [
    { id: "p-fr", name: "France", country: "France", type: "country", image: null },
    { id: "p-pt", name: "Portugal", country: "Portugal", type: "country", image: null },
    { id: "p-es", name: "Spain", country: "Spain", type: "country", image: null },
    { id: "p-it", name: "Italy", country: "Italy", type: "country", image: null },
    { id: "c-paris", name: "Paris", country: "France", type: "city", image: null },
    { id: "c-lisbon", name: "Lisbon", country: "Portugal", type: "city", image: null },
    { id: "c-madrid", name: "Madrid", country: "Spain", type: "city", image: null },
    { id: "c-rome", name: "Rome", country: "Italy", type: "city", image: null },
  ],
}));
vi.mock("@/lib/native/placeGeocoder", () => ({
  PlaceGeocoder: {
    reverseGeocode: async ({ lat }: { lat: number }) =>
      lat > 48
        ? { found: true, names: ["Paris"], countryCode: "FR" }
        : lat > 41.5
          ? { found: true, names: ["Rome"], countryCode: "IT" }
          : lat > 40
            ? { found: true, names: ["Madrid"], countryCode: "ES" }
            : { found: true, names: ["Lisbon"], countryCode: "PT" },
  },
}));
vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      delete: () => q,
      update: () => q,
      insert: (row: any) => {
        h.inserts.push({ table, row });
        return { select: async () => ({ data: [{ id: "r1" }], error: null }), then: (r: any) => r({ error: null }) };
      },
      then: (resolve: any) =>
        resolve({ data: table === "reviews" ? [{ place_id: "p-it" }, { place_id: "c-rome" }] : [], error: null }),
    };
    return q;
  };
  return { supabase: { from } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/components/DestinationPoster", () => ({ DestinationPoster: ({ name }: { name: string }) => <div>{name}</div> }));

import ImportPhotosPage from "@/pages/ImportPhotosPage";
import { LanguageProvider } from "@/contexts/LanguageContext";

const days = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`);

beforeEach(() => {
  localStorage.clear();
  h.inserts = [];
  const topology = JSON.parse(readFileSync(join(__dirname, "../../public/countries-50m.json"), "utf8"));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => topology })));
  h.scan.mockResolvedValue({
    access: "granted",
    total: 400,
    located: 300,
    cells: [
      // Home: a month of photos in Paris.
      ...days("2024-03", 30).map((day) => ({ lat: 48.86, lng: 2.35, day, count: 5 })),
      // One trip to Lisbon in May 2023.
      { lat: 38.72, lng: -9.14, day: "2023-05-02", count: 4 },
      { lat: 38.72, lng: -9.14, day: "2023-05-03", count: 2 },
      // Two trips to Madrid, two years apart.
      { lat: 40.42, lng: -3.7, day: "2022-06-10", count: 3 },
      { lat: 40.42, lng: -3.7, day: "2024-08-03", count: 3 },
      // Rome: already logged.
      { lat: 41.9, lng: 12.5, day: "2021-04-01", count: 9 },
    ],
  });
});

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 1000)); });

describe("Find countries in photos", () => {
  it("asks about home, pre-fills a single trip, leaves several trips undated, saves and sums up", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter>
          <ImportPhotosPage />
        </MemoryRouter>
      </LanguageProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /look through my photos/i }));
    await flush();

    // Home country question; skipping it leaves France out.
    expect(screen.getByText("Do you live in France?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /yes, skip it/i }));

    // Most recent first: Spain (2024), then Portugal (2023). Italy is already logged.
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByText("Spain")).toBeTruthy();
    expect(screen.getByText(/several trips, 2022–2024/)).toBeTruthy();
    const [yearSelect, monthSelect] = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(yearSelect.value).toBe("");
    expect(monthSelect.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    await act(async () => {});

    expect(screen.getByText("2 of 2")).toBeTruthy();
    expect(screen.getByText("Portugal")).toBeTruthy();
    expect(screen.getByText(/May 2023/)).toBeTruthy();
    // (The skipped card may still be animating out, so look the fields up by value.)
    expect((screen.getByDisplayValue("2023") as HTMLSelectElement).tagName).toBe("SELECT");
    expect((screen.getByDisplayValue("May") as HTMLSelectElement).tagName).toBe("SELECT");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });
    await act(async () => {});

    const review = h.inserts.find((i) => i.table === "reviews");
    expect(review?.row).toMatchObject({ user_id: "me", place_id: "p-pt", visit_year: 2023, visit_month: 5 });
    expect(h.inserts.filter((i) => i.table === "reviews")).toHaveLength(1);
    expect(screen.getByText("1 country added")).toBeTruthy();
  });
});

describe("Find cities in photos", () => {
  it("names the places, asks about the home city, and saves a city with its visit date", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/import-photos?type=city"]}>
          <ImportPhotosPage />
        </MemoryRouter>
      </LanguageProvider>
    );

    expect(screen.getByText("Find the cities you've been to")).toBeTruthy();
    // Opened for cities: no Countries/Cities choice.
    expect(screen.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /look through my photos/i }));
    await flush();

    expect(screen.getByText("Do you live in Paris?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /yes, skip it/i }));

    // Madrid (2024) then Lisbon (2023); Rome is already logged.
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByText("Madrid")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    await act(async () => {});
    expect(screen.getByText("Lisbon")).toBeTruthy();
    expect(screen.getByText(/May 2023/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });
    await act(async () => {});

    const review = h.inserts.find((i) => i.table === "reviews");
    expect(review?.row).toMatchObject({ user_id: "me", place_id: "c-lisbon", visit_year: 2023, visit_month: 5 });
    expect(screen.getByText("1 city added")).toBeTruthy();
  });

  it("from Settings, the user picks countries or cities", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/import-photos"]}>
          <ImportPhotosPage />
        </MemoryRouter>
      </LanguageProvider>
    );
    expect(screen.getByText("Find the countries you've been to")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Cities" }));
    expect(screen.getByText("Find the cities you've been to")).toBeTruthy();
  });
});
