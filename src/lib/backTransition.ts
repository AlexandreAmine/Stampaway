// Same slide-off as finishing an edge swipe-back (EdgeSwipeBack), so tapping
// a back arrow animates the way swiping back does instead of cutting.
const SLIDE_MS = 200;

let sliding = false;

/**
 * Slides the current page off to the right, then runs `goBack` (normally
 * `navigate(-1)`). Taps during the slide are ignored, so a double tap can't
 * go back two pages. Instant when the system asks for reduced motion.
 */
export function slideBack(goBack: () => void) {
  if (sliding) return;
  const el = typeof document !== "undefined" ? document.getElementById("route-container") : null;
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!el || reduceMotion) {
    goBack();
    return;
  }

  sliding = true;
  el.style.transition = `transform ${SLIDE_MS}ms ease-out`;
  el.style.transform = `translateX(${window.innerWidth}px)`;
  window.setTimeout(() => {
    clearSlideWhenRouteChanges(() => {
      el.style.transition = "";
      el.style.transform = "";
      sliding = false;
    });
    goBack();
  }, SLIDE_MS + 10);
}

// Undoing the slide has to happen in the same frame the previous page is
// drawn: earlier, the page that just slid away would flash back for a
// frame; later, the previous page would show shifted. Route changes render
// as transitions, which can take a frame or two, so RouteTransition calls
// runPendingSlideClear() as it commits the new location.
let pendingClear: (() => void) | null = null;

export function clearSlideWhenRouteChanges(clear: () => void) {
  pendingClear = clear;
  // Safety net if no route change follows (nothing to go back to).
  window.setTimeout(() => {
    if (pendingClear === clear) runPendingSlideClear();
  }, 1000);
}

export function runPendingSlideClear() {
  const clear = pendingClear;
  pendingClear = null;
  clear?.();
}
