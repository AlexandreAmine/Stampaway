import { useEffect, useRef } from "react";

/**
 * Lets a page with an internal "drill-down" view — local component state
 * that swaps the whole screen, rather than a real route (e.g. Profile's
 * Countries/Map/Diary/etc. tabs) — participate in the same swipe-back and
 * tab-re-tap conventions as routed pages (EdgeSwipeBack, BottomNav).
 *
 * Only one handler is ever active at a time, matching the app's single
 * visible screen. A page registers while its internal sub-view is open and
 * clears it on close/unmount.
 */

type BackHandler = () => void;

let activeHandler: BackHandler | null = null;

function setPageBackHandler(handler: BackHandler | null) {
  activeHandler = handler;
}

export function hasPageBackHandler(): boolean {
  return activeHandler !== null;
}

/** Invokes the registered handler, if any. Returns true if it handled it. */
export function invokePageBackHandler(): boolean {
  if (!activeHandler) return false;
  activeHandler();
  return true;
}

/**
 * Registers `onBack` while `active` is true. Call from the page that owns
 * the internal sub-view, e.g.:
 *
 *   usePageBackHandler(!!subPage, () => setSubPage(null));
 */
export function usePageBackHandler(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    setPageBackHandler(() => onBackRef.current());
    return () => setPageBackHandler(null);
  }, [active]);
}
