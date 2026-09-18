import { describe, it, expect } from "vitest";
import { sizedPosterUrl } from "@/lib/imageSizing";

const params = (url: string) => new URL(url).searchParams;

describe("sizedPosterUrl", () => {
  it("returns null for null or undefined", () => {
    expect(sizedPosterUrl(null, 400)).toBeNull();
    expect(sizedPosterUrl(undefined, 400)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(sizedPosterUrl("", 400)).toBeNull();
  });

  it("leaves non-CDN hosts untouched", () => {
    const url = "https://example.supabase.co/storage/v1/object/public/posters/a.jpg";
    expect(sizedPosterUrl(url, 300)).toBe(url);
  });

  it("leaves a data URI untouched", () => {
    const url = "data:image/svg+xml;utf8,<svg/>";
    expect(sizedPosterUrl(url, 300)).toBe(url);
  });

  it("returns the original string when the URL cannot be parsed", () => {
    expect(sizedPosterUrl("not a url", 300)).toBe("not a url");
  });

  it("sets width and a 3:4 height on Unsplash URLs", () => {
    const out = sizedPosterUrl("https://images.unsplash.com/photo-123", 300)!;
    expect(params(out).get("w")).toBe("300");
    expect(params(out).get("h")).toBe("400");
  });

  it("sets width and a 3:4 height on Pexels URLs", () => {
    const out = sizedPosterUrl("https://images.pexels.com/photos/1/pexels-photo-1.jpeg", 180)!;
    expect(params(out).get("w")).toBe("180");
    expect(params(out).get("h")).toBe("240");
  });

  it("rounds the derived height rather than truncating", () => {
    // 130 * 4 / 3 = 173.33 -> 173
    const out = sizedPosterUrl("https://images.unsplash.com/photo-123", 130)!;
    expect(params(out).get("h")).toBe("173");
  });

  it("defaults Unsplash to fit=crop when no fit is present", () => {
    const out = sizedPosterUrl("https://images.unsplash.com/photo-123", 300)!;
    expect(params(out).get("fit")).toBe("crop");
  });

  it("preserves an existing Unsplash fit parameter", () => {
    const out = sizedPosterUrl("https://images.unsplash.com/photo-123?fit=fill", 300)!;
    expect(params(out).get("fit")).toBe("fill");
  });

  it("always forces fit=crop on Pexels, overriding any existing value", () => {
    const out = sizedPosterUrl("https://images.pexels.com/photos/1.jpeg?fit=fill", 300)!;
    expect(params(out).get("fit")).toBe("crop");
  });

  it("keeps unrelated query parameters intact", () => {
    const out = sizedPosterUrl("https://images.unsplash.com/photo-123?q=80&auto=format", 300)!;
    expect(params(out).get("q")).toBe("80");
    expect(params(out).get("auto")).toBe("format");
  });

  it("overwrites a previously applied width instead of appending a second one", () => {
    const out = sizedPosterUrl("https://images.unsplash.com/photo-123?w=900&h=1200", 300)!;
    expect(params(out).getAll("w")).toEqual(["300"]);
    expect(params(out).getAll("h")).toEqual(["400"]);
  });

  it("preserves the host and path", () => {
    const out = sizedPosterUrl("https://images.unsplash.com/photo-abc", 300)!;
    const u = new URL(out);
    expect(u.hostname).toBe("images.unsplash.com");
    expect(u.pathname).toBe("/photo-abc");
  });
});
