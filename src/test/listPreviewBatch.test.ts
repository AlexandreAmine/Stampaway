import { describe, it, expect, vi, beforeEach } from "vitest";

const place = (id: string) => ({ id, name: id, country: "X", type: "city", image: null });

const h = vi.hoisted(() => ({
  calls: [] as { table: string; filters: string[] }[],
  // What the batched `lists` query returns, and whether it fails.
  batchRows: [] as any[],
  batchError: null as unknown,
  // Per-list fallback answers (list_items queried directly).
  single: {} as Record<string, any[]>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const call = { table, filters: [] as string[] };
    h.calls.push(call);
    let listId = "";
    const q: any = {
      select: () => q,
      order: () => q,
      limit: () => q,
      in: (c: string, v: string[]) => { call.filters.push(`${c} in ${v.join(",")}`); return q; },
      eq: (c: string, v: string) => { listId = v; call.filters.push(`${c}=${v}`); return q; },
      then: (resolve: (v: unknown) => void) =>
        resolve(
          table === "lists"
            ? { data: h.batchError ? null : h.batchRows, error: h.batchError }
            : { data: (h.single[listId] ?? []).map((p) => ({ places: p })), error: null }
        ),
    };
    return q;
  };
  return { supabase: { from } };
});

import {
  fetchListPreviewPosters,
  getListPreviewPostersRequestToken,
  invalidateListPreviewPostersCache,
} from "@/lib/listPreviewPostersCache";

const load = (listId: string, maxItems = 8) =>
  fetchListPreviewPosters("me", listId, maxItems, getListPreviewPostersRequestToken("me", listId));

beforeEach(() => {
  invalidateListPreviewPostersCache();
  h.calls = [];
  h.batchRows = [];
  h.batchError = null;
  h.single = {};
});

describe("list preview posters batching", () => {
  it("previews requested together share one request", async () => {
    h.batchRows = [
      { id: "l1", list_items: [{ places: place("p1") }, { places: place("p2") }] },
      { id: "l2", list_items: [] },
      { id: "l3", list_items: [{ places: place("p3") }] },
    ];
    const [a, b, c] = await Promise.all([load("l1"), load("l2"), load("l3")]);
    expect(a.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(b).toEqual([]);
    expect(c.map((p) => p.id)).toEqual(["p3"]);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]).toMatchObject({ table: "lists", filters: ["id in l1,l2,l3"] });
  });

  it("a list the batch doesn't return falls back to its own query", async () => {
    h.batchRows = [{ id: "l1", list_items: [{ places: place("p1") }] }];
    h.single = { l2: [place("p9")] };
    const [, b] = await Promise.all([load("l1"), load("l2")]);
    expect(b.map((p) => p.id)).toEqual(["p9"]);
    expect(h.calls.map((c) => c.table)).toEqual(["lists", "list_items"]);
  });

  it("a failed batch falls back to one query per list", async () => {
    h.batchError = new Error("boom");
    h.single = { l1: [place("p1")], l2: [place("p2")] };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const [a, b] = await Promise.all([load("l1"), load("l2")]);
    expect([a[0].id, b[0].id]).toEqual(["p1", "p2"]);
    expect(h.calls.filter((c) => c.table === "list_items")).toHaveLength(2);
  });

  it("a single preview uses the original per-list query", async () => {
    h.single = { l1: [place("p1")] };
    expect((await load("l1")).map((p) => p.id)).toEqual(["p1"]);
    expect(h.calls.map((c) => c.table)).toEqual(["list_items"]);
  });

  it("different preview sizes are batched separately", async () => {
    h.batchRows = [{ id: "l1", list_items: [] }, { id: "l2", list_items: [] }];
    await Promise.all([load("l1", 4), load("l2", 4), load("l1", 8), load("l2", 8)]);
    expect(h.calls.filter((c) => c.table === "lists")).toHaveLength(2);
  });

  it("results are cached: asking again makes no request", async () => {
    h.batchRows = [{ id: "l1", list_items: [] }, { id: "l2", list_items: [] }];
    await Promise.all([load("l1"), load("l2")]);
    h.calls = [];
    await load("l1");
    expect(h.calls).toHaveLength(0);
  });
});
