import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>,
  calls: [] as { table: string; select?: string; filters: string[] }[],
}));

// Supabase stub: answers each table from h.rows and records the query.
vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const call = { table, select: undefined as string | undefined, filters: [] as string[] };
    h.calls.push(call);
    const q: any = {
      select: (s: string) => { call.select = s; return q; },
      eq: (c: string, v: string) => { call.filters.push(`${c}=${v}`); return q; },
      in: (c: string, v: string[]) => { call.filters.push(`${c} in ${v.join(",")}`); return q; },
      ilike: (c: string, v: string) => { call.filters.push(`${c}~${v}`); return q; },
      limit: () => q,
      then: (resolve: (v: unknown) => void) => resolve({ data: h.rows[table] ?? [], error: null }),
    };
    return q;
  };
  return { supabase: { from } };
});

import { fetchSearchLists } from "@/lib/searchLists";

const list = (id: string, user_id: string, items: number, likes: number) => ({
  id, name: `List ${id}`, description: null, user_id,
  item_count: [{ count: items }], like_count: [{ count: likes }],
});

beforeEach(() => {
  h.calls = [];
  h.rows = {
    lists: [list("a", "pub", 3, 1), list("b", "priv", 5, 9), list("c", "privFollowed", 2, 4), list("d", "me", 7, 0)],
    profiles: [
      { user_id: "pub", username: "pub", profile_picture: null, is_private: false },
      { user_id: "priv", username: "priv", profile_picture: null, is_private: true },
      { user_id: "privFollowed", username: "pf", profile_picture: null, is_private: true },
      { user_id: "me", username: "me", profile_picture: null, is_private: true },
    ],
    followers: [{ following_id: "privFollowed" }],
  };
});

describe("fetchSearchLists", () => {
  it("hides private owners' lists unless followed or your own, most liked first", async () => {
    const result = await fetchSearchLists("", "me");
    expect(result.map((l) => l.id)).toEqual(["c", "a", "d"]);
  });

  it("reads item and like counts from the embedded counts", async () => {
    const result = await fetchSearchLists("", "me");
    const c = result.find((l) => l.id === "c")!;
    expect(c).toMatchObject({ item_count: 2, like_count: 4, profiles: { username: "pf" } });
  });

  it("makes three requests, never one per list", async () => {
    await fetchSearchLists("", "me");
    expect(h.calls.map((c) => c.table).sort()).toEqual(["followers", "lists", "profiles"]);
    expect(h.calls.find((c) => c.table === "lists")!.select).toContain("list_items(count)");
    expect(h.calls.find((c) => c.table === "followers")!.filters).toContain("follower_id=me");
  });

  it("signed out: only public owners' lists, no follows query", async () => {
    const result = await fetchSearchLists("", null);
    expect(result.map((l) => l.id)).toEqual(["a"]);
    expect(h.calls.some((c) => c.table === "followers")).toBe(false);
  });

  it("filters by name when there is a query", async () => {
    await fetchSearchLists("japan", "me");
    expect(h.calls.find((c) => c.table === "lists")!.filters).toContain("name~%japan%");
  });

  it("no lists: no further requests", async () => {
    h.rows.lists = [];
    expect(await fetchSearchLists("zzz", "me")).toEqual([]);
    expect(h.calls).toHaveLength(1);
  });
});
