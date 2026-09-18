import { describe, it, expect } from "vitest";
import { dedupeByNewest, type ReviewLike } from "@/lib/reviewDedup";

// These semantics are mirrored server-side by the get_place_stats RPC
// (migration 20260708100000). If this file changes, that function must change
// with it or client and server stats will silently disagree.

const review = (over: Partial<ReviewLike> & { id: string }): ReviewLike => ({
  created_at: "2026-01-01T00:00:00Z",
  visit_year: null,
  visit_month: null,
  ...over,
});

const byId = (items: ReviewLike[]) => items.map((i) => i.id);

describe("dedupeByNewest", () => {
  it("returns one entry per key", () => {
    const out = dedupeByNewest(
      [
        review({ id: "a", place_id: "p1" }),
        review({ id: "b", place_id: "p1" }),
        review({ id: "c", place_id: "p2" }),
      ],
      (r) => r.place_id as string
    );
    expect(out).toHaveLength(2);
  });

  it("prefers a higher visit_year", () => {
    const out = dedupeByNewest(
      [
        review({ id: "older", place_id: "p1", visit_year: 2019 }),
        review({ id: "newer", place_id: "p1", visit_year: 2024 }),
      ],
      (r) => r.place_id as string
    );
    expect(byId(out)).toEqual(["newer"]);
  });

  it("prefers a higher visit_month within the same year", () => {
    const out = dedupeByNewest(
      [
        review({ id: "march", place_id: "p1", visit_year: 2024, visit_month: 3 }),
        review({ id: "november", place_id: "p1", visit_year: 2024, visit_month: 11 }),
      ],
      (r) => r.place_id as string
    );
    expect(byId(out)).toEqual(["november"]);
  });

  it("treats a null visit_month as month 0, losing to any real month", () => {
    const out = dedupeByNewest(
      [
        review({ id: "no-month", place_id: "p1", visit_year: 2024, visit_month: null }),
        review({ id: "january", place_id: "p1", visit_year: 2024, visit_month: 1 }),
      ],
      (r) => r.place_id as string
    );
    expect(byId(out)).toEqual(["january"]);
  });

  it("ranks any dated entry above an undated one, even a much newer undated one", () => {
    const out = dedupeByNewest(
      [
        review({
          id: "undated-but-recent",
          place_id: "p1",
          created_at: "2026-09-01T00:00:00Z",
        }),
        review({
          id: "dated-but-old",
          place_id: "p1",
          visit_year: 1999,
          created_at: "2020-01-01T00:00:00Z",
        }),
      ],
      (r) => r.place_id as string
    );
    expect(byId(out)).toEqual(["dated-but-old"]);
  });

  it("falls back to the newest created_at when neither entry has a visit date", () => {
    const out = dedupeByNewest(
      [
        review({ id: "old", place_id: "p1", created_at: "2021-01-01T00:00:00Z" }),
        review({ id: "recent", place_id: "p1", created_at: "2026-01-01T00:00:00Z" }),
      ],
      (r) => r.place_id as string
    );
    expect(byId(out)).toEqual(["recent"]);
  });

  it("falls back to created_at when visit dates are identical", () => {
    const out = dedupeByNewest(
      [
        review({
          id: "logged-first",
          place_id: "p1",
          visit_year: 2024,
          visit_month: 6,
          created_at: "2024-07-01T00:00:00Z",
        }),
        review({
          id: "logged-later",
          place_id: "p1",
          visit_year: 2024,
          visit_month: 6,
          created_at: "2024-08-01T00:00:00Z",
        }),
      ],
      (r) => r.place_id as string
    );
    expect(byId(out)).toEqual(["logged-later"]);
  });

  it("dedupes by user_id just as well as by place_id", () => {
    const out = dedupeByNewest(
      [
        review({ id: "a", user_id: "u1", visit_year: 2020 }),
        review({ id: "b", user_id: "u1", visit_year: 2025 }),
        review({ id: "c", user_id: "u2", visit_year: 2021 }),
      ],
      (r) => r.user_id as string
    );
    expect(byId(out).sort()).toEqual(["b", "c"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      review({ id: "a", place_id: "p1", visit_year: 2020 }),
      review({ id: "b", place_id: "p1", visit_year: 2025 }),
    ];
    const snapshot = byId(input);
    dedupeByNewest(input, (r) => r.place_id as string);
    expect(byId(input)).toEqual(snapshot);
  });

  it("returns an empty array for empty input", () => {
    expect(dedupeByNewest([], (r) => r.id as string)).toEqual([]);
  });
});
