/**
 * Each tab's own trail of screens, like a native tab bar: leave Explore on a
 * place, look at your Profile, tap Explore again and you're back on that
 * place (and Back still leads to Explore). The browser history is a single
 * line, so the trail is tracked here and replayed when the tab is reopened.
 *
 * Kept in memory only: like a native app, every launch starts on the tabs'
 * first screens.
 */
export interface StackEntry {
  pathname: string;
  search: string;
  state: unknown;
}

type NavType = "PUSH" | "POP" | "REPLACE";

// Long trails are trimmed from the oldest screens (the tab's root is kept).
const MAX_DEPTH = 20;

let stacks: Record<string, StackEntry[]> = {};

const sameScreen = (a: StackEntry, b: StackEntry) => a.pathname === b.pathname && a.search === b.search;

/** Navigations replayed by restoreTab carry this in their history state. */
export const RESTORED = "tabRestore";

export function isRestoredEntry(state: unknown): boolean {
  return !!state && typeof state === "object" && (state as Record<string, unknown>)[RESTORED] === true;
}

/** Notes where the user went within `tab` (the tab the screen belongs to). */
export function recordNavigation(tab: string, entry: StackEntry, navType: NavType): void {
  // A replay (restoring the tab) puts back the trail it came from: nothing
  // to note, and its root mustn't wipe the trail.
  if (navType === "PUSH" && isRestoredEntry(entry.state)) return;
  if (entry.pathname === tab) {
    stacks[tab] = [entry];
    return;
  }

  const stack = stacks[tab] ?? [{ pathname: tab, search: "", state: null }];
  const top = stack[stack.length - 1];

  if (navType === "POP") {
    // Back to a screen of the trail: drop what was above it.
    let index = -1;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (sameScreen(stack[i], entry)) {
        index = i;
        break;
      }
    }
    if (index >= 0) {
      stacks[tab] = [...stack.slice(0, index), entry];
      return;
    }
  }

  if ((navType === "REPLACE" && stack.length > 1) || sameScreen(top, entry)) {
    stacks[tab] = [...stack.slice(0, -1), entry];
    return;
  }

  const next = [...stack, entry];
  stacks[tab] = next.length > MAX_DEPTH ? [next[0], ...next.slice(next.length - MAX_DEPTH + 1)] : next;
}

/** The screens to reopen above the tab's root, oldest first (empty: just the root). */
export function trailAboveRoot(tab: string): StackEntry[] {
  return (stacks[tab] ?? []).slice(1);
}

/** Forgets every trail (sign-out, another account). */
export function resetTabStacks(): void {
  stacks = {};
}
