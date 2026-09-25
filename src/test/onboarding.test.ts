import { describe, it, expect, beforeEach, vi } from "vitest";

// Both mocks are controlled per test: `native` flips the platform, and the
// Preferences store stands in for iOS UserDefaults.
const h = vi.hoisted(() => ({
  native: false,
  prefs: new Map<string, string>(),
  prefsThrows: false,
}));

vi.mock("@/lib/native/platform", () => ({
  isNative: () => h.native,
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => {
      if (h.prefsThrows) throw new Error("storage unavailable");
      return { value: h.prefs.get(key) ?? null };
    }),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      if (h.prefsThrows) throw new Error("storage unavailable");
      h.prefs.set(key, value);
    }),
  },
}));

import { hasSeenIntro, hasSeenIntroSync, markIntroSeen } from "@/lib/onboarding";

const KEY = "stampaway_intro_seen_v1";

beforeEach(() => {
  localStorage.clear();
  h.prefs.clear();
  h.native = false;
  h.prefsThrows = false;
});

describe("first-launch intro flag — web", () => {
  it("is unseen on a fresh device", async () => {
    expect(hasSeenIntroSync()).toBe(false);
    expect(await hasSeenIntro()).toBe(false);
  });

  it("is seen after marking, on both the sync and async paths", async () => {
    await markIntroSeen();
    expect(hasSeenIntroSync()).toBe(true);
    expect(await hasSeenIntro()).toBe(true);
  });

  it("never touches native Preferences on web", async () => {
    await markIntroSeen();
    expect(h.prefs.size).toBe(0);
  });

  it("treats any value other than the marker as unseen", async () => {
    localStorage.setItem(KEY, "true");
    expect(await hasSeenIntro()).toBe(false);
  });
});

describe("first-launch intro flag — native", () => {
  beforeEach(() => {
    h.native = true;
  });

  it("writes the durable Preferences copy as well as the mirror", async () => {
    await markIntroSeen();
    expect(h.prefs.get(KEY)).toBe("1");
    expect(localStorage.getItem(KEY)).toBe("1");
  });

  it("stays seen after iOS evicts localStorage", async () => {
    await markIntroSeen();
    localStorage.clear(); // WKWebView storage-pressure eviction
    expect(await hasSeenIntro()).toBe(true);
  });

  it("restores the localStorage mirror after recovering from eviction", async () => {
    h.prefs.set(KEY, "1");
    await hasSeenIntro();
    expect(hasSeenIntroSync()).toBe(true);
  });

  it("falls back to unseen rather than throwing when Preferences fails", async () => {
    h.prefsThrows = true;
    await expect(hasSeenIntro()).resolves.toBe(false);
  });

  it("still records completion in the mirror when Preferences fails", async () => {
    h.prefsThrows = true;
    await expect(markIntroSeen()).resolves.toBeUndefined();
    expect(hasSeenIntroSync()).toBe(true);
  });
});
