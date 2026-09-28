import { describe, it, expect, vi } from "vitest";
import { PERF_ENABLED, perfMark, perfNavStart, perfReady } from "@/lib/perfMarks";

describe("perf markers", () => {
  // Normal builds (and tests) must not emit anything: the markers only exist
  // in builds made with VITE_PERF_MARKS=1.
  it("are off unless the build opts in", () => {
    expect(PERF_ENABLED).toBe(false);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    perfMark("js-start");
    perfNavStart("/explore", "PUSH");
    perfReady("explore");
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
});
