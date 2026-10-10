import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetLaunchPrompts, setFindCountriesPrompt, whenFindCountriesPromptDone } from "@/lib/launchPrompts";

describe("launch prompts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetLaunchPrompts();
  });
  afterEach(() => vi.useRealTimers());

  it("waits while the find-countries pop-up is showing, however long", async () => {
    let done = false;
    setFindCountriesPrompt("showing");
    void whenFindCountriesPromptDone().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(done).toBe(false);
    setFindCountriesPrompt("done");
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });

  it("stops waiting if the pop-up never comes", async () => {
    let done = false;
    void whenFindCountriesPromptDone().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(done).toBe(true);
  });

  it("once done, never waits again", async () => {
    setFindCountriesPrompt("done");
    setFindCountriesPrompt("showing");
    let done = false;
    void whenFindCountriesPromptDone().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });
});
