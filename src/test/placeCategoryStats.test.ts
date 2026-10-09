import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  rpc: null as null | (() => Promise<any>),
  tables: {} as Record<string, any[]>,
}));

// A tiny stand-in for the Supabase query builder: filters rows by eq/in and
// honours order + limit + maybeSingle, enough for the calls under test.
vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    let rows = [...(h.tables[table] || [])];
    const q: any = {
      select: () => q,
      eq: (col: string, v: any) => ((rows = rows.filter((r) => r[col] === v)), q),
      in: (col: string, vs: any[]) => ((rows = rows.filter((r) => vs.includes(r[col]))), q),
      order: (col: string, { ascending }: { ascending: boolean }) => (
        (rows = rows.sort((a, b) => (a[col] < b[col] ? -1 : 1) * (ascending ? 1 : -1))), q
      ),
      limit: (n: number) => ((rows = rows.slice(0, n)), q),
      maybeSingle: async () => ({ data: rows[0] ?? null }),
      then: (resolve: any) => resolve({ data: rows }),
    };
    return q;
  };
  return { supabase: { from, rpc: () => h.rpc!() } };
});

import { fetchPlaceCategoryStats } from "@/lib/placeCategoryStats";

beforeEach(() => {
  h.tables = {
    reviews: [
      { id: "r1", place_id: "p", user_id: "me", created_at: "2024-01-01" },
      { id: "r2", place_id: "p", user_id: "me", created_at: "2025-01-01" },
      { id: "r3", place_id: "p", user_id: "other", created_at: "2025-02-01" },
      { id: "r4", place_id: "elsewhere", user_id: "other", created_at: "2025-02-01" },
    ],
    review_sub_ratings: [
      { review_id: "r1", category: "Food", rating: 2 },
      { review_id: "r2", category: "Food", rating: 4 },
      { review_id: "r2", category: "Safety & Security", rating: 5 },
      { review_id: "r3", category: "Food", rating: 5 },
      { review_id: "r4", category: "Food", rating: 1 },
    ],
  };
});

describe("fetchPlaceCategoryStats", () => {
  it("uses the server summary, in the app's category order", async () => {
    h.rpc = async () => ({
      data: [
        { category: "Safety & Security", avg_rating: 5, rating_count: 1 },
        { category: "Food", avg_rating: 3.666666, rating_count: 3 },
      ],
      error: null,
    });
    const { averages, myRatings } = await fetchPlaceCategoryStats("p", "me");
    expect(averages).toEqual([
      { category: "Safety & Security", avg: 5, count: 1 },
      { category: "Food", avg: 3.7, count: 3 },
    ]);
    // The viewer's latest review of the place.
    expect(myRatings.map((r) => r.category).sort()).toEqual(["Food", "Safety & Security"]);
  });

  it("falls back to computing on the phone while the function isn't installed", async () => {
    h.rpc = async () => ({ data: null, error: { code: "PGRST202", message: "not found" } });
    const { averages } = await fetchPlaceCategoryStats("p", undefined);
    expect(averages).toEqual([
      { category: "Safety & Security", avg: 5, count: 1 },
      { category: "Food", avg: 3.7, count: 3 },
    ]);
  });

  it("other failures are errors, not an empty result", async () => {
    h.rpc = async () => ({ data: null, error: { code: "", message: "Failed to fetch" } });
    await expect(fetchPlaceCategoryStats("p", "me")).rejects.toBeTruthy();
  });
});
