import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  isPrivate: false,
  insertError: null as unknown,
  inserts: [] as { table: string; row: any }[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      single: async () => ({ data: { is_private: h.isPrivate }, error: null }),
      insert: async (row: any) => {
        h.inserts.push({ table, row });
        return { error: h.insertError };
      },
    };
    return q;
  };
  return { supabase: { from } };
});

import { followOrRequest } from "@/lib/followActions";

beforeEach(() => {
  h.isPrivate = false;
  h.insertError = null;
  h.inserts = [];
});

describe("followOrRequest", () => {
  it("follows a public account directly", async () => {
    expect(await followOrRequest("me", "pub")).toBe("following");
    expect(h.inserts).toEqual([{ table: "followers", row: { follower_id: "me", following_id: "pub" } }]);
  });

  it("sends a request to a private account, never a direct follow", async () => {
    h.isPrivate = true;
    expect(await followOrRequest("me", "priv")).toBe("requested");
    expect(h.inserts).toEqual([{ table: "follow_requests", row: { requester_id: "me", target_id: "priv" } }]);
  });

  it("throws when the save fails, so callers can undo", async () => {
    h.insertError = new Error("nope");
    await expect(followOrRequest("me", "pub")).rejects.toThrow("nope");
  });
});
