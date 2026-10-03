import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { PERF_ENABLED, perfMark, perfNavStart } from "@/lib/perfMarks";

// Per-path scroll memory. Restores scroll when returning to a previously
// visited path (via tab switch or back/forward); resets to top for new paths.
const scrollPositions = new Map<string, number>();

/** True when visiting this path will restore a scroll position below the top. */
export function hasSavedScrollPosition(key: string) {
  return (scrollPositions.get(key) ?? 0) > 0;
}

// If a page isn't tall enough yet when we come back to it (content still
// arriving), keep re-applying the saved position for a short while.
const RESTORE_RETRY_MS = 800;

export default function ScrollRestoration() {
  const { pathname, search } = useLocation();
  const navType = useNavigationType();
  const key = pathname + search;
  const keyRef = useRef(key);

  // Record the position of whichever page is currently showing. The page is
  // read from keyRef, which switches in the layout effect below, so the next
  // page's scroll-to-top is recorded against the next page. (Previously an
  // effect cleanup saved window.scrollY for the page being left — but it ran
  // after the new page had already scrolled to the top, so every page was
  // saved as 0 and going back always landed at the top.)
  useEffect(() => {
    const save = () => {
      scrollPositions.set(keyRef.current, window.scrollY);
    };
    window.addEventListener("scroll", save, { passive: true });
    // iOS doesn't deliver every scroll event while a swipe's momentum winds
    // down, so the last recorded position can lag the real one by a few
    // hundred pixels. Every navigation starts with a touch or a tap, and
    // window.scrollY is always current when read, so record it there too,
    // in the capture phase — before any handler can navigate away.
    document.addEventListener("touchstart", save, { capture: true, passive: true });
    document.addEventListener("click", save, { capture: true });
    return () => {
      window.removeEventListener("scroll", save);
      document.removeEventListener("touchstart", save, { capture: true });
      document.removeEventListener("click", save, { capture: true });
    };
  }, []);

  // Restore (or reset) on route change, before paint to avoid flash
  useLayoutEffect(() => {
    keyRef.current = key;
    const saved = scrollPositions.get(key);
    perfNavStart(key, navType);

    if (saved == null || saved <= 0) {
      window.scrollTo(0, 0);
      return;
    }

    window.scrollTo(0, saved);

    const report = (when: string) => {
      if (PERF_ENABLED) {
        perfMark("scroll-restore", `${key} wanted ${Math.round(saved)} got ${Math.round(window.scrollY)} (${when})`);
      }
    };
    report("immediately");

    // Content may still be rendering (the page is shorter than the saved
    // position, so the browser clamped the scroll). Re-apply each frame until
    // it sticks, the time budget runs out, or the user takes over.
    let frame = 0;
    let cancelled = false;
    const startedAt = performance.now();
    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    const retry = () => {
      if (cancelled) return;
      if (Math.abs(window.scrollY - saved) <= 2) {
        report("after retry");
        return stop();
      }
      if (performance.now() - startedAt > RESTORE_RETRY_MS) {
        report("gave up");
        return stop();
      }
      window.scrollTo(0, saved);
      frame = requestAnimationFrame(retry);
    };
    if (Math.abs(window.scrollY - saved) > 2) frame = requestAnimationFrame(retry);

    window.addEventListener("touchstart", stop, { passive: true, once: true });
    window.addEventListener("wheel", stop, { passive: true, once: true });
    return () => {
      stop();
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("wheel", stop);
    };
  }, [key, navType]);

  return null;
}
