import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Root tabs: switching between them is lateral (tab-bar) navigation, not a
// push — no slide. Mirrors EdgeSwipeBack's list.
const ROOT_PATHS = new Set([
  "/",
  "/explore",
  "/add",
  "/search",
  "/profile",
  "/welcome",
  "/auth",
]);

const PUSH_MS = 240;

/**
 * iOS-style push transition (Checkpoint 8 / B2): forward navigation slides
 * the incoming page in from the right, mirroring the interactive swipe-back.
 * Back (POP) navigation and tab switches stay instant, exactly like a native
 * navigation stack. Uses the Web Animations API so no styles linger.
 */
export default function RouteTransition() {
  const location = useLocation();
  const navType = useNavigationType();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    const cameFrom = prevPathRef.current;
    prevPathRef.current = location.pathname;

    if (navType !== "PUSH") return;
    if (location.pathname === cameFrom) return;
    // Tab-bar destinations are lateral, not pushes
    if (ROOT_PATHS.has(location.pathname)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = document.getElementById("route-container");
    if (!el) return;

    el.animate(
      [
        { transform: "translateX(100%)" },
        { transform: "translateX(0px)" },
      ],
      { duration: PUSH_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
    );
  }, [location.pathname, navType]);

  return null;
}
