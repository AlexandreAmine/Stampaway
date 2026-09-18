import { describe, it, expect } from "vitest";
import { fallbackAvatarUrl } from "@/lib/avatarFallback";

// The SVG is URI-encoded into a data: URI, so decode before asserting on markup.
const decoded = (name?: string | null) =>
  decodeURIComponent(fallbackAvatarUrl(name).replace("data:image/svg+xml;utf8,", ""));

const initialsOf = (name?: string | null) =>
  decoded(name).match(/>([^<]*)<\/text>/)?.[1];

describe("fallbackAvatarUrl", () => {
  it("returns an inline SVG data URI, never a network URL", () => {
    expect(fallbackAvatarUrl("Alice")).toMatch(/^data:image\/svg\+xml;utf8,/);
  });

  it("uses the first letter for a single-word name", () => {
    expect(initialsOf("Alice")).toBe("A");
  });

  it("uses first and last initials for a two-word name", () => {
    expect(initialsOf("Alice Smith")).toBe("AS");
  });

  it("uses first and LAST initials, skipping middle names", () => {
    expect(initialsOf("Alice Beatrice Carter")).toBe("AC");
  });

  it("uppercases lowercase input", () => {
    expect(initialsOf("alice smith")).toBe("AS");
  });

  it("falls back to ? for an empty name", () => {
    expect(initialsOf("")).toBe("?");
  });

  it("falls back to ? for null and undefined", () => {
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf(undefined)).toBe("?");
  });

  it("falls back to ? for whitespace only", () => {
    expect(initialsOf("   ")).toBe("?");
  });

  it("collapses repeated whitespace between words", () => {
    expect(initialsOf("Alice    Smith")).toBe("AS");
  });

  it("ignores leading and trailing whitespace", () => {
    expect(initialsOf("  Alice Smith  ")).toBe("AS");
  });

  it("uses a smaller font for two initials than for one", () => {
    expect(decoded("Alice Smith")).toContain('font-size="22"');
    expect(decoded("Alice")).toContain('font-size="26"');
  });

  it("keeps the brand background colour", () => {
    expect(decoded("Alice")).toContain('fill="#3B82F6"');
  });

  it("produces a stable result for the same input", () => {
    expect(fallbackAvatarUrl("Alice Smith")).toBe(fallbackAvatarUrl("Alice Smith"));
  });

  it("percent-encodes the payload so the data URI has no raw angle brackets", () => {
    const url = fallbackAvatarUrl("Alice");
    expect(url).not.toContain("<");
    expect(url).not.toContain(">");
  });
});
