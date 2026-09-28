import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { PERF_ENABLED, perfMark, perfNavStart } from "@/lib/perfMarks";

// Per-path scroll memory. Restores scroll when returning to a previously
// visited path (via tab switch or back/forward); resets to top for new paths.
const scrollPositions = new Map<string, number>();

export default function ScrollRestoration() {
  const { pathname, search } = useLocation();
  const navType = useNavigationType();
  const key = pathname + search;

  // Save scroll position before unmounting/changing route
  useEffect(() => {
    const handler = () => {
      scrollPositions.set(key, window.scrollY);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      scrollPositions.set(key, window.scrollY);
      window.removeEventListener("scroll", handler);
    };
  }, [key]);

  // Restore (or reset) on route change, before paint to avoid flash
  useLayoutEffect(() => {
    const saved = scrollPositions.get(key);
    perfNavStart(key, navType);
    if (navType === "POP" && saved != null) {
      window.scrollTo(0, saved);
    } else if (saved != null) {
      window.scrollTo(0, saved);
    } else {
      window.scrollTo(0, 0);
    }
    // Measurement only: did the restore actually land where we left off?
    if (PERF_ENABLED && saved != null && saved > 0) {
      const report = (when: string) =>
        perfMark("scroll-restore", `${key} wanted ${Math.round(saved)} got ${Math.round(window.scrollY)} (${when})`);
      report("immediately");
      const timer = window.setTimeout(() => report("after 600ms"), 600);
      return () => window.clearTimeout(timer);
    }
  }, [key, navType]);

  return null;
}
