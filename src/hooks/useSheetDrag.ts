import { useCallback, useEffect, useRef } from "react";

const DECIDE_PX = 6; // movement before deciding between drag and scroll
const CLOSE_DISTANCE_PX = 120; // pulled this far down → close
const CLOSE_VELOCITY = 0.5; // px/ms: a quick flick closes from a shorter pull
const FLICK_MIN_PX = 30;
const SPRING_MS = 200;

/** The nearest element between `target` and `panel` (inclusive) that scrolls vertically. */
function scrollerFor(target: EventTarget | null, panel: HTMLElement): HTMLElement | null {
  let el = target instanceof HTMLElement ? target : null;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) return el;
    if (el === panel) return null;
    el = el.parentElement;
  }
  return null;
}

/**
 * Swipe a bottom sheet down to close it, like iOS sheets: the sheet follows
 * the finger when pulled down from anywhere while its content is scrolled to
 * the top; letting go far enough (or with a quick flick) closes it, otherwise
 * it springs back. Scrolling the content works as before.
 *
 * Returns a ref for the sheet panel. `onClose` should start the sheet's normal
 * closing animation, which then continues from where the finger left it.
 */
export function useSheetDrag(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panelRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const attach = useCallback((panel: HTMLElement) => {
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let mode: "undecided" | "drag" | "ignore" = "ignore";
    let dy = 0;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        mode = "ignore";
        return;
      }
      const scroller = scrollerFor(e.target, panel);
      // Content scrolled down: a downward swipe scrolls it back up instead.
      mode = scroller && scroller.scrollTop > 0 ? "ignore" : "undecided";
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = performance.now();
      dy = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (mode === "ignore") return;
      const moveX = e.touches[0].clientX - startX;
      const moveY = e.touches[0].clientY - startY;
      if (mode === "undecided") {
        if (Math.abs(moveX) < DECIDE_PX && Math.abs(moveY) < DECIDE_PX) return;
        // Only a mostly-vertical pull downwards drags the sheet; anything
        // else (scrolling up, sideways gestures like star ratings) is left alone.
        if (moveY <= 0 || Math.abs(moveX) > Math.abs(moveY)) {
          mode = "ignore";
          return;
        }
        mode = "drag";
        panel.style.transition = "none";
      }
      e.preventDefault();
      dy = Math.max(0, moveY);
      panel.style.transform = `translateY(${dy}px)`;
    };

    const onEnd = () => {
      if (mode !== "drag") {
        mode = "ignore";
        return;
      }
      mode = "ignore";
      const velocity = dy / Math.max(1, performance.now() - startTime);
      if (dy > CLOSE_DISTANCE_PX || (velocity > CLOSE_VELOCITY && dy > FLICK_MIN_PX)) {
        // The closing animation starts from the current position.
        panel.style.transition = "";
        onCloseRef.current();
        return;
      }
      panel.style.transition = `transform ${SPRING_MS}ms ease-out`;
      panel.style.transform = "translateY(0px)";
      window.setTimeout(() => {
        panel.style.transition = "";
        panel.style.transform = "";
      }, SPRING_MS + 20);
    };

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd);
    panel.addEventListener("touchcancel", onEnd);
    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return useCallback(
    (panel: HTMLElement | null) => {
      if (panel === panelRef.current) return;
      cleanupRef.current?.();
      cleanupRef.current = null;
      panelRef.current = panel;
      if (panel) cleanupRef.current = attach(panel);
    },
    [attach]
  );
}

/**
 * True while a sheet or dialog is open. Page-level gestures (pull to refresh,
 * edge swipe-back) check this so a gesture inside a sheet never also acts on
 * the page underneath it.
 */
export function isOverlayOpen(): boolean {
  return !!document.querySelector('[role="dialog"][data-state="open"], [data-overlay-open]');
}
