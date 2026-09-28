import { describe, it, expect } from "vitest";
import { relativeDays, timeAgo } from "@/lib/localeFormat";

const NOW = new Date("2026-06-15T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

// The hand-written English helper this replaced, kept to pin its output.
function previousEnglish(dateStr: string) {
  const diffDays = Math.floor((NOW.getTime() - new Date(dateStr).getTime()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

describe("relativeDays", () => {
  it("matches the previous English output exactly", () => {
    for (const n of [0, 1, 2, 6, 7, 13, 29, 30, 45, 200]) {
      expect(relativeDays(daysAgo(n), "en", NOW), `${n} days`).toBe(previousEnglish(daysAgo(n)));
    }
  });

  it("speaks the app language", () => {
    expect(relativeDays(daysAgo(0), "fr", NOW)).toBe("aujourd’hui");
    expect(relativeDays(daysAgo(1), "es", NOW)).toBe("ayer");
    expect(relativeDays(daysAgo(3), "fr", NOW)).toMatch(/^il y a 3/);
    expect(relativeDays(daysAgo(3), "nl", NOW)).toMatch(/geleden$/);
  });
});

describe("timeAgo", () => {
  it("drops 'about' in English only", () => {
    const twoHours = new Date(Date.now() - 2 * 3600000);
    expect(timeAgo(twoHours, "en")).toBe("2 hours ago");
    expect(timeAgo(twoHours, "fr")).toBe("il y a environ 2 heures");
  });
});
