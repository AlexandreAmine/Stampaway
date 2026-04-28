import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

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
    if (navType === "POP" && saved != null) {
      window.scrollTo(0, saved);
    } else if (saved != null) {
      window.scrollTo(0, saved);
    } else {
      window.scrollTo(0, 0);
    }
  }, [key, navType]);

  return null;
}
