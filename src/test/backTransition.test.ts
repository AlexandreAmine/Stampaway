import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { slideBack } from "@/lib/backTransition";

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
    vi.advanceTimersByTime(100);
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
});
