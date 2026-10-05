import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { slideBack, runPendingSlideClear } from "@/lib/backTransition";

let reduceMotion = false;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "requestAnimationFrame"] });
  reduceMotion = false;
  window.matchMedia = ((q: string) => ({ matches: reduceMotion && q.includes("reduce") })) as any;
  document.body.innerHTML = '<div id="route-container"></div>';
});
afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

describe("slideBack", () => {
  it("slides the page off first, then goes back, then clears the slide", () => {
    const goBack = vi.fn();
    const el = document.getElementById("route-container")!;
    slideBack(goBack);
    expect(el.style.transform).toContain("translateX");
    expect(goBack).not.toHaveBeenCalled();
    vi.advanceTimersByTime(250);
    expect(goBack).toHaveBeenCalledTimes(1);
    // Still slid away until the previous page is committed…
    vi.advanceTimersByTime(100);
    expect(el.style.transform).toContain("translateX");
    // …then cleared in that same commit.
    runPendingSlideClear();
    expect(el.style.transform).toBe("");
  });

  it("a second tap during the slide doesn't go back twice", () => {
    const goBack = vi.fn();
    slideBack(goBack);
    slideBack(goBack);
    vi.advanceTimersByTime(400);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it("goes back at once when reduced motion is on", () => {
    reduceMotion = true;
    const goBack = vi.fn();
    slideBack(goBack);
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(document.getElementById("route-container")!.style.transform).toBe("");
  });

  it("clears anyway if no route change follows", () => {
    const el = document.getElementById("route-container")!;
    slideBack(() => {});
    vi.advanceTimersByTime(250 + 1000);
    expect(el.style.transform).toBe("");
  });
});
