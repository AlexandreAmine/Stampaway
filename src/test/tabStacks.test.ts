import { describe, it, expect, beforeEach } from "vitest";
import { RESTORED, recordNavigation, resetTabStacks, trailAboveRoot } from "@/lib/tabStacks";

const e = (pathname: string, state: unknown = null) => ({ pathname, search: "", state });
const paths = (tab: string) => trailAboveRoot(tab).map((x) => x.pathname);

beforeEach(() => resetTabStacks());

describe("tab trails", () => {
  it("remembers the screens opened in a tab", () => {
    recordNavigation("/explore", e("/explore"), "PUSH");
    recordNavigation("/explore", e("/place/fr"), "PUSH");
    recordNavigation("/explore", e("/place/paris"), "PUSH");
    expect(paths("/explore")).toEqual(["/place/fr", "/place/paris"]);
  });

  it("going back drops the screens above", () => {
    recordNavigation("/explore", e("/place/fr"), "PUSH");
    recordNavigation("/explore", e("/place/paris"), "PUSH");
    recordNavigation("/explore", e("/place/fr"), "POP");
    expect(paths("/explore")).toEqual(["/place/fr"]);
    recordNavigation("/explore", e("/explore"), "POP");
    expect(paths("/explore")).toEqual([]);
  });

  it("each tab keeps its own trail", () => {
    recordNavigation("/explore", e("/place/fr"), "PUSH");
    recordNavigation("/profile", e("/profile"), "PUSH");
    recordNavigation("/profile", e("/settings"), "PUSH");
    expect(paths("/explore")).toEqual(["/place/fr"]);
    expect(paths("/profile")).toEqual(["/settings"]);
  });

  it("re-tapping a tab (its root) starts it over", () => {
    recordNavigation("/explore", e("/place/fr"), "PUSH");
    recordNavigation("/explore", e("/explore"), "PUSH");
    expect(paths("/explore")).toEqual([]);
  });

  it("replaying a trail doesn't change it", () => {
    recordNavigation("/explore", e("/place/fr"), "PUSH");
    recordNavigation("/explore", e("/place/paris"), "PUSH");
    recordNavigation("/explore", e("/explore", { [RESTORED]: true }), "PUSH");
    recordNavigation("/explore", e("/place/fr", { [RESTORED]: true }), "PUSH");
    recordNavigation("/explore", e("/place/paris", { [RESTORED]: true }), "PUSH");
    expect(paths("/explore")).toEqual(["/place/fr", "/place/paris"]);
  });

  it("a replaced screen takes the place of the top one", () => {
    recordNavigation("/explore", e("/place/fr"), "PUSH");
    recordNavigation("/explore", e("/place/es"), "REPLACE");
    expect(paths("/explore")).toEqual(["/place/es"]);
  });

  it("very long trails keep the most recent screens", () => {
    for (let i = 0; i < 30; i++) recordNavigation("/explore", e(`/place/${i}`), "PUSH");
    const trail = paths("/explore");
    expect(trail).toHaveLength(19);
    expect(trail[trail.length - 1]).toBe("/place/29");
  });
});
