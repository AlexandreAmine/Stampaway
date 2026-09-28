import { useEffect, useRef } from "react";

/**
 * Timing markers for measuring perceived speed (optimization checkpoint 0).
 *
 * Off by default and compiled out of normal builds: only a build made with
 * `VITE_PERF_MARKS=1 npm run build` contains them. Lines go to console.info
 * as `[perf] ...` (console.log is stripped from production builds); on the
 * simulator, `scripts/measure-perf.sh` captures them with timestamps.
 *
 * All times are ms since the web view started loading the app
 * (performance.now()), so launch marks line up with each other.
 */
export const PERF_ENABLED = import.meta.env.VITE_PERF_MARKS === "1";

let navStart: { at: number; to: string; type: string } | null = null;
const readyForNav = new Set<string>();

const ms = (n: number) => `${Math.round(n)}ms`;

/** A one-off moment, e.g. "auth-resolved" or "splash-hide". */
export function perfMark(name: string, detail?: string) {
  if (!PERF_ENABLED) return;
  console.info(`[perf] ${name} @${ms(performance.now())}${detail ? ` ${detail}` : ""}`);
}

/** Called on every route change; later "ready" marks are timed from here. */
export function perfNavStart(to: string, type: string) {
  if (!PERF_ENABLED) return;
  navStart = { at: performance.now(), to, type };
  readyForNav.clear();
  perfMark("nav", `${type} ${to}`);
}

/**
 * A screen's main content is on screen (from cache or network). Logged once
 * per navigation, with the time since that navigation started.
 */
export function perfReady(screen: string, detail?: string) {
  if (!PERF_ENABLED || readyForNav.has(screen)) return;
  readyForNav.add(screen);
  const since = navStart ? ` +${ms(performance.now() - navStart.at)} after ${navStart.type} ${navStart.to}` : "";
  perfMark(`ready:${screen}`, `${since}${detail ? ` (${detail})` : ""}`);
}

/**
 * Hook form of perfReady: logs once `isReady` first becomes true after the
 * screen mounts. Pure no-op (no effect work) when markers are compiled out.
 */
export function usePerfReady(screen: string, isReady: boolean, detail?: string) {
  const logged = useRef(false);
  useEffect(() => {
    if (!PERF_ENABLED || logged.current || !isReady) return;
    logged.current = true;
    // Wait for the frame that actually shows the content.
    requestAnimationFrame(() => perfReady(screen, detail));
  }, [screen, isReady, detail]);
}
