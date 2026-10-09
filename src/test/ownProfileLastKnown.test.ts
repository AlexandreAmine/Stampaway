import { describe, it, expect, vi, beforeEach } from "vitest";

async function freshModule() {
  vi.resetModules();
  return import("@/lib/profileContentCache");
}

describe("own profile last-known content", () => {
  beforeEach(() => localStorage.clear());

  it("survives a relaunch, Sets included", async () => {
    const before = await freshModule();
    before.setOwnProfileContentCache("u1", { countriesCount: 41, map: { visited: new Set(["FR", "PT"]) } });

    const after = await freshModule();
    const data = after.getLastKnownOwnProfileContent<any>("u1");
    expect(data.countriesCount).toBe(41);
    expect(data.map.visited).toBeInstanceOf(Set);
    expect([...data.map.visited]).toEqual(["FR", "PT"]);
  });

  it("is never shown to another account", async () => {
    const before = await freshModule();
    before.setOwnProfileContentCache("u1", { countriesCount: 41 });
    const after = await freshModule();
    expect(after.getLastKnownOwnProfileContent("u2")).toBeNull();
  });

  it("still shows the last content after an invalidation, until the refetch replaces it", async () => {
    const cache = await freshModule();
    cache.setOwnProfileContentCache("u1", { countriesCount: 41 });
    cache.invalidateOwnProfileContentCache("u1");
    expect(cache.getFreshOwnProfileContentCache("u1")).toBeNull();
    expect(cache.getLastKnownOwnProfileContent<any>("u1").countriesCount).toBe(41);
  });
});
