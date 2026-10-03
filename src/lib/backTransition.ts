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
    goBack();
    // Cleared on the next frame so the previous page never renders shifted.
    const clear = () => {
      el.style.transition = "";
      el.style.transform = "";
      sliding = false;
    };
    requestAnimationFrame(clear);
    // In case animation frames are throttled.
    window.setTimeout(clear, 80);
  }, SLIDE_MS + 10);
}
