import { useEffect, useLayoutEffect, useRef } from "react";
import { MODAL_PATHS } from "@/lib/modalRoutes";
import { runPendingSlideClear } from "@/lib/backTransition";
import { isRestoredEntry } from "@/lib/tabStacks";
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
const MODAL_OPEN_MS = 360;

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

  // A finished back slide (swipe or back arrow) is undone in the same frame
  // the previous page appears.
  useLayoutEffect(() => {
    runPendingSlideClear();
  }, [location.key]);

  useEffect(() => {
    const cameFrom = prevPathRef.current;
    prevPathRef.current = location.pathname;

    if (navType !== "PUSH") return;
    if (location.pathname === cameFrom) return;
    // Reopening a tab on the screen it was left on: lateral, like any tab switch.
    if (isRestoredEntry(location.state)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Modal screens (the add screen, finding countries in photos) rise from
    // the bottom instead of sliding in from the side (closing: dismissModal).
    if (MODAL_PATHS.has(location.pathname)) {
      document.getElementById("route-container")?.animate(
        [
          { transform: "translateY(40%)", opacity: 0 },
          { transform: "translateY(0px)", opacity: 1 },
        ],
        { duration: MODAL_OPEN_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
      );
      return;
    }
    // Tab-bar destinations are lateral, not pushes
    if (ROOT_PATHS.has(location.pathname)) return;

    const el = document.getElementById("route-container");
    if (!el) return;

    el.animate(
      [
        { transform: "translateX(100%)" },
        { transform: "translateX(0px)" },
      ],
      { duration: PUSH_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)" }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navType]);

  return null;
}
