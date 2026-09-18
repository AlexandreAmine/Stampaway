import { describe, it, expect } from "vitest";
import {
  SOCIAL_PLATFORMS,
  getPlatformConfig,
  formatHandle,
  sanitizeSocialLinks,
} from "@/lib/socialLinks";

const buildUrl = (key: Parameters<typeof getPlatformConfig>[0], raw: string) =>
  getPlatformConfig(key)!.buildUrl(raw);

describe("getPlatformConfig", () => {
  it("resolves every declared platform", () => {
    for (const p of SOCIAL_PLATFORMS) {
      expect(getPlatformConfig(p.key)?.key).toBe(p.key);
    }
  });

  it("has unique keys across platforms", () => {
    const keys = SOCIAL_PLATFORMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("buildUrl handle cleaning", () => {
  it("accepts a bare username", () => {
    expect(buildUrl("instagram", "traveler")).toBe("https://instagram.com/traveler");
  });

  it("strips a leading @", () => {
    expect(buildUrl("instagram", "@traveler")).toBe("https://instagram.com/traveler");
  });

  it("strips repeated leading @", () => {
    expect(buildUrl("instagram", "@@traveler")).toBe("https://instagram.com/traveler");
  });

  it("trims surrounding whitespace", () => {
    expect(buildUrl("instagram", "  traveler  ")).toBe("https://instagram.com/traveler");
  });

  it("extracts the handle from a pasted full URL", () => {
    expect(buildUrl("instagram", "https://instagram.com/traveler")).toBe(
      "https://instagram.com/traveler"
    );
  });

  it("extracts the handle from a pasted URL with a trailing slash", () => {
    expect(buildUrl("instagram", "https://instagram.com/traveler/")).toBe(
      "https://instagram.com/traveler"
    );
  });

  it("drops a query string", () => {
    expect(buildUrl("instagram", "traveler?igsh=abc123")).toBe(
      "https://instagram.com/traveler"
    );
  });

  it("keeps only the first path segment", () => {
    expect(buildUrl("instagram", "traveler/reels")).toBe("https://instagram.com/traveler");
  });

  it("prefixes @ for YouTube channels", () => {
    expect(buildUrl("youtube", "mychannel")).toBe("https://youtube.com/@mychannel");
  });

  it("does not double the @ for YouTube when one was typed", () => {
    expect(buildUrl("youtube", "@mychannel")).toBe("https://youtube.com/@mychannel");
  });

  it("prefixes @ for TikTok", () => {
    expect(buildUrl("tiktok", "dancer")).toBe("https://tiktok.com/@dancer");
  });

  it("builds X and Facebook URLs without an @", () => {
    expect(buildUrl("x", "@poster")).toBe("https://x.com/poster");
    expect(buildUrl("facebook", "@page")).toBe("https://facebook.com/page");
  });
});

describe("formatHandle", () => {
  it("prefixes @ for display", () => {
    expect(formatHandle("instagram", "traveler")).toBe("@traveler");
  });

  it("does not double the @ when input already has one", () => {
    expect(formatHandle("instagram", "@traveler")).toBe("@traveler");
  });

  it("returns an empty string for empty input", () => {
    expect(formatHandle("instagram", "")).toBe("");
    expect(formatHandle("instagram", "   ")).toBe("");
  });

  it("formats YouTube and TikTok with a single @", () => {
    expect(formatHandle("youtube", "chan")).toBe("@chan");
    expect(formatHandle("tiktok", "@dancer")).toBe("@dancer");
  });
});

describe("sanitizeSocialLinks", () => {
  it("returns an empty object for null, undefined and non-objects", () => {
    expect(sanitizeSocialLinks(null)).toEqual({});
    expect(sanitizeSocialLinks(undefined)).toEqual({});
    expect(sanitizeSocialLinks("instagram")).toEqual({});
    expect(sanitizeSocialLinks(42)).toEqual({});
  });

  it("keeps known platforms and strips their handles", () => {
    expect(sanitizeSocialLinks({ instagram: "@traveler", x: "poster" })).toEqual({
      instagram: "traveler",
      x: "poster",
    });
  });

  it("drops unknown keys", () => {
    expect(sanitizeSocialLinks({ instagram: "traveler", myspace: "retro" })).toEqual({
      instagram: "traveler",
    });
  });

  it("drops non-string values", () => {
    expect(sanitizeSocialLinks({ instagram: 123, x: null, facebook: "page" })).toEqual({
      facebook: "page",
    });
  });

  it("drops entries that clean down to nothing", () => {
    expect(sanitizeSocialLinks({ instagram: "@", x: "   ", tiktok: "dancer" })).toEqual({
      tiktok: "dancer",
    });
  });

  it("normalises a pasted full URL down to the handle", () => {
    expect(sanitizeSocialLinks({ instagram: "https://instagram.com/traveler/" })).toEqual({
      instagram: "traveler",
    });
  });

  it("returns a plain object with no prototype surprises", () => {
    const out = sanitizeSocialLinks({ instagram: "traveler" });
    expect(Object.keys(out)).toEqual(["instagram"]);
  });
});
