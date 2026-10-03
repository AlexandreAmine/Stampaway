import { describe, it, expect, vi } from "vitest";
import { selectInChunks, newestFirst, IN_CHUNK_SIZE } from "@/lib/inChunks";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);

describe("selectInChunks", () => {
  it("up to the batch size it is exactly one request with all ids", async () => {
    const query = vi.fn(async (chunk: string[]) => ({ data: chunk.map((id) => ({ id })), error: null }));
    const res = await selectInChunks(ids(IN_CHUNK_SIZE), query);
    expect(query).toHaveBeenCalledTimes(1);
    expect(res.data).toHaveLength(IN_CHUNK_SIZE);
  });

  it("splits longer lists and joins every row back", async () => {
    const query = vi.fn(async (chunk: string[]) => ({ data: chunk.map((id) => ({ id })), error: null }));
    const res = await selectInChunks(ids(IN_CHUNK_SIZE * 2 + 5), query);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls.every(([c]) => c.length <= IN_CHUNK_SIZE)).toBe(true);
    expect(new Set(res.data!.map((r) => r.id)).size).toBe(IN_CHUNK_SIZE * 2 + 5);
  });

  it("any failed batch fails the whole query", async () => {
    let n = 0;
    const res = await selectInChunks(ids(IN_CHUNK_SIZE + 1), async () =>
      ++n === 2 ? { data: null, error: new Error("boom") } : { data: [{ id: "x" }], error: null }
    );
    expect(res.data).toBeNull();
    expect(res.error).toBeInstanceOf(Error);
  });

  it("re-sorts and limits joined rows like a single ordered request", async () => {
    // Each batch returns its own newest two (as `.order().limit(2)` would).
    const rows = ids(IN_CHUNK_SIZE + 10).map((id, i) => ({ id, created_at: new Date(2026, 0, 1, 0, i).toISOString() }));
    const res = await selectInChunks(
      rows.map((r) => r.id),
      async (chunk) => ({
        data: rows.filter((r) => chunk.includes(r.id)).sort(newestFirst("created_at")).slice(0, 2),
        error: null,
      }),
      { sort: newestFirst("created_at"), limit: 2 }
    );
    const expected = [...rows].sort(newestFirst("created_at")).slice(0, 2).map((r) => r.id);
    expect(res.data!.map((r) => r.id)).toEqual(expected);
  });
});
