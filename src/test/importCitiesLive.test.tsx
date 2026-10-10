import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Each lookup waits until the test answers it, to control the search's pace.
const h = vi.hoisted(() => ({
  pending: [] as { lat: number; resolve: (v: unknown) => void }[],
  inserts: [] as { table: string; row: any }[],
}));

vi.mock("@/lib/native/photoTrips", () => ({
  canFindCountriesInPhotos: () => true,
  PhotoTrips: {
    checkAccess: async () => ({ access: "granted" }),
    requestAccess: async () => ({ access: "granted" }),
    scan: async () => ({
      access: "granted",
      total: 30,
      located: 30,
      cells: [
        { lat: 47.56, lng: 13.65, day: "2024-07-01", count: 4 }, // Hallstatt
        { lat: 47.56, lng: 13.65, day: "2024-07-02", count: 4 },
        { lat: 51.05, lng: 3.72, day: "2023-04-10", count: 5 }, // Ghent
        { lat: 9.5, lng: 100.0, day: "2022-02-01", count: 6 }, // Koh Samui
      ],
    }),
    openSettings: async () => {},
  },
}));
vi.mock("@/lib/native/placeGeocoder", () => ({
  PlaceGeocoder: {
    reverseGeocode: ({ lat }: { lat: number }) => new Promise((resolve) => h.pending.push({ lat, resolve })),
  },
}));
vi.mock("@/lib/placeRankings", () => ({
  clearRankingsCache: () => {},
  fetchAllPlaces: async () => [
    { id: "c-hallstatt", name: "Hallstatt", country: "Austria", type: "city", image: null },
    { id: "c-ghent", name: "Ghent", country: "Belgium", type: "city", image: null },
    { id: "c-samui", name: "Koh Samui", country: "Thailand", type: "city", image: null },
  ],
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
      then: (resolve: any) => resolve({ data: [], error: null }),
    };
    return q;
  };
  return { supabase: { from } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/components/DestinationPoster", () => ({ DestinationPoster: ({ name }: { name: string }) => <div>{name}</div> }));

import ImportPhotosPage from "@/pages/ImportPhotosPage";
import { LanguageProvider } from "@/contexts/LanguageContext";

const answers: Record<string, unknown> = {
  "47.56": { found: true, names: ["Hallstatt"], countryCode: "AT" },
  "51.05": { found: true, names: ["Ghent"], countryCode: "BE" },
  "9.5": { found: true, names: ["Koh Samui"], countryCode: "TH" },
};
/** Answers the lookup for the place at `lat`. */
const answer = async (lat: number) => {
  const request = h.pending.find((p) => p.lat === lat);
  if (!request) throw new Error(`no lookup for ${lat}`);
  h.pending = h.pending.filter((p) => p !== request);
  await act(async () => request.resolve(answers[String(lat)]));
};

beforeEach(() => {
  localStorage.clear();
  h.pending = [];
  h.inserts = [];
  const topology = JSON.parse(readFileSync(join(__dirname, "../../public/countries-50m.json"), "utf8"));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => topology })));
});

describe("finding cities while logging", () => {
  it("opens the cards at once and keeps adding cities as they're found", async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={["/import-photos?type=city"]}>
          <ImportPhotosPage />
        </MemoryRouter>
      </LanguageProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /look through my photos/i }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    // Three places, looked up at the same time.
    expect(h.pending).toHaveLength(3);

    await answer(47.56);
    // One found: the cards open straight away, the other lookups still running.
    fireEvent.click(screen.getByRole("button", { name: "Show 1 city found" }));
    expect(screen.getByText("Hallstatt")).toBeTruthy();
    expect(screen.getByText("1 of 1")).toBeTruthy();

    await answer(51.05);
    expect(screen.getByText("1 of 2")).toBeTruthy();

    // Logging the cards meanwhile: Ghent comes next.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    });
    await act(async () => {});
    expect(screen.getByText("Ghent")).toBeTruthy();

    // Out of cards while still searching: it waits for the next city.
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    await act(async () => {});
    expect(screen.getByText(/Finding the cities/)).toBeTruthy();
    await answer(9.5);
    expect(screen.getByText("Koh Samui")).toBeTruthy();
    expect(screen.getByText("3 of 3")).toBeTruthy();

    // The last one: the summary.
    fireEvent.click(screen.getByRole("button", { name: /^skip$/i }));
    await act(async () => {});
    expect(screen.getByText("1 city added")).toBeTruthy();
  });
});
