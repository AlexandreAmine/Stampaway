import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ALL_COUNTRIES, getCountryCode, getFlagUrl } from "@/lib/countryFlags";

const root = resolve(__dirname, "../..");
const PNG_SIGNATURE = "89504e470d0a1a0a";

describe("bundled flags", () => {
  // Every country the app can show must have both flag sizes in public/flags,
  // or that flag would silently disappear.
  it("ships both sizes for every known country", () => {
    const missing: string[] = [];
    for (const country of ALL_COUNTRIES) {
      const code = getCountryCode(country)?.toLowerCase();
      if (!code) continue;
      for (const size of ["w80", "w160"]) {
        const file = resolve(root, "public/flags", size, `${code}.png`);
        if (!existsSync(file) || readFileSync(file).subarray(0, 8).toString("hex") !== PNG_SIGNATURE) {
          missing.push(`${size}/${code} (${country})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("points at the bundled files, never a remote host", () => {
    expect(getFlagUrl("France", 40)).toBe("/flags/w80/fr.png");
    expect(getFlagUrl("France", 160)).toBe("/flags/w160/fr.png");
    expect(getFlagUrl("Atlantis")).toBeNull();
  });
});
