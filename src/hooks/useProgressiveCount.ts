import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { hasSavedScrollPosition } from "@/components/ScrollRestoration";
/**
 * How many items of a long list to render right now. Starts with `initial`
 * (enough to fill the first screen) and adds `step` more every frame until
 * all `total` are on the page, so the screen appears on the first frame
 * instead of after every poster has mounted. The end result is the same page.
 *
 * When this visit restores a saved scroll position, everything renders at
 * once: the saved position may be far down, and it must be there on the
 * first frame for the restore to land exactly (as it did before).
 *
 * Changing `resetKey` (a new filter or query) starts again from `initial`.
 */
export function useProgressiveCount(
  total: number,
  { initial, step, resetKey = "" }: { initial: number; step: number; resetKey?: string }
): number {
  const { pathname, search } = useLocation();
  const [state, setState] = useState(() => ({
    resetKey,
    count: hasSavedScrollPosition(pathname + search) ? Number.POSITIVE_INFINITY : initial,
  }));
  const count = state.resetKey === resetKey ? state.count : initial;

  useEffect(() => {
    if (count >= total) return;
    const frame = requestAnimationFrame(() => setState({ resetKey, count: count + step }));
    return () => cancelAnimationFrame(frame);
  }, [count, total, step, resetKey]);

  return Math.min(count, total);
}
