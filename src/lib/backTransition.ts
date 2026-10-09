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
  animateOff(
    { transition: `transform ${SLIDE_MS}ms ease-out`, transform: `translateX(${window.innerWidth}px)` },
    SLIDE_MS,
    goBack
  );
}

// The add screen opens like an iOS modal (rising from the bottom, see
// RouteTransition) and closes the same way: down and out.
const MODAL_CLOSE_MS = 220;

/** Closes a screen presented as a modal: it sinks and fades, then `goBack` runs. */
export function dismissModal(goBack: () => void) {
  animateOff(
    {
      transition: `transform ${MODAL_CLOSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1), opacity ${MODAL_CLOSE_MS}ms ease-out`,
      transform: "translateY(30%)",
      opacity: "0",
    },
    MODAL_CLOSE_MS,
    goBack
  );
}

function animateOff(styles: Partial<Record<"transition" | "transform" | "opacity", string>>, ms: number, goBack: () => void) {
  if (sliding) return;
  const el = typeof document !== "undefined" ? document.getElementById("route-container") : null;
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (!el || reduceMotion) {
    goBack();
    return;
  }

  sliding = true;
  Object.assign(el.style, styles);
  window.setTimeout(() => {
    clearSlideWhenRouteChanges(() => {
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
      sliding = false;
    });
    goBack();
  }, ms + 10);
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
