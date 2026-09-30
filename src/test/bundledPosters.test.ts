import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDestinationPosterOverride } from "@/lib/countryPosterOverrides";
import { sizedPosterUrl } from "@/lib/imageSizing";

const root = resolve(__dirname, "../..");
const JPEG_SIGNATURE = "ffd8ff";
const OVERRIDES: [string, "country" | "city"][] = [
  ["Portugal", "country"], ["Qatar", "country"], ["Vanuatu", "country"], ["Bhutan", "country"],
  ["Eritrea", "country"], ["Iraq", "country"], ["Liberia", "country"], ["Uganda", "country"],
  ["Libya", "country"], ["Mongolia", "country"], ["Russia", "country"], ["Saint Lucia", "country"],
  ["London", "city"], ["Athens", "city"], ["Marrakesh", "city"], ["Budapest", "city"],
  ["Ibiza", "city"], ["Lisbon", "city"],
];

describe("bundled override posters", () => {
  // Every override must resolve to a real JPEG in every width a screen can
  // ask for, or that destination would show a broken image.
  it("ship in all three widths for every overridden destination", () => {
    const missing: string[] = [];
    for (const [name, type] of OVERRIDES) {
      const url = getDestinationPosterOverride(name, type);
      expect(url, name).toBeTruthy();
      for (const width of [100, 400, 900]) {
        const file = resolve(root, "public" + sizedPosterUrl(url, width));
        if (!existsSync(file) || readFileSync(file).subarray(0, 3).toString("hex") !== JPEG_SIGNATURE) {
          missing.push(`${name} @${width}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("no longer point at a remote host", () => {
    for (const [name, type] of OVERRIDES) {
      expect(getDestinationPosterOverride(name, type)).not.toMatch(/^https?:/);
    }
  });
});
