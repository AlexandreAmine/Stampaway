/**
 * Keeps the launch-time prompts from stacking up: the iOS "allow
 * notifications" alert waits until the "find your countries in your photos"
 * pop-up is out of the way — closed, or the photo import it led to finished.
 */
type State = "pending" | "showing" | "done";

let state: State = "pending";
const waiters = new Set<() => void>();

// If the pop-up hasn't appeared by then, it isn't going to this launch.
const GIVE_UP_WAITING_MS = 10_000;

export function setFindCountriesPrompt(next: "showing" | "done"): void {
  if (state === "done") return;
  state = next;
  if (state === "done") {
    waiters.forEach((resolve) => resolve());
    waiters.clear();
  }
}

/** Resolves once the pop-up is done with (or never came). */
export function whenFindCountriesPromptDone(): Promise<void> {
  if (state === "done") return Promise.resolve();
  return new Promise((resolve) => {
    waiters.add(resolve);
    window.setTimeout(() => {
      if (state === "pending") setFindCountriesPrompt("done");
    }, GIVE_UP_WAITING_MS);
  });
}

/** For tests. */
export function resetLaunchPrompts(): void {
  state = "pending";
  waiters.clear();
}
