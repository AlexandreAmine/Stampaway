let initialized = false;

/**
 * Native pattern (Instagram/Letterboxd): scrolling the page while typing
 * dismisses the keyboard.
 *
 * Details that make it feel right instead of broken:
 * - iOS auto-scrolls the focused input into view when the keyboard opens;
 *   scrolls within a grace window after focus are ignored (otherwise the
 *   keyboard would close itself immediately).
 * - Only reacts to WINDOW scrolls (page content). Inputs inside internally
 *   scrolling sheets keep their keyboard.
 * - A real user scroll must move a meaningful distance before blurring.
 */
export function initScrollKeyboardDismiss() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const FOCUS_GRACE_MS = 600;
  const SCROLL_DISTANCE_PX = 40;

  let focusedAt = 0;
  let baselineY = window.scrollY;

  document.addEventListener(
    "focusin",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        focusedAt = Date.now();
        baselineY = window.scrollY;
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    () => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      if (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA") return;

      if (Date.now() - focusedAt < FOCUS_GRACE_MS) {
        // iOS scrolling the input into view — track, don't dismiss
        baselineY = window.scrollY;
        return;
      }

      if (Math.abs(window.scrollY - baselineY) > SCROLL_DISTANCE_PX) {
        active.blur();
      }
    },
    { passive: true }
  );
}
