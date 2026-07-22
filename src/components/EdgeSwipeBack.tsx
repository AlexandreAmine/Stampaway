import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hasPageBackHandler, invokePageBackHandler } from "@/lib/pageBackStack";

// Root tabs where swipe-back should do nothing
const ROOT_PATHS = new Set([
  "/",
  "/explore",
  "/add",
  "/search",
  "/profile",
  "/welcome",
  "/auth",
]);

const EDGE_PX = 24; // start zone from left edge
const THRESHOLD_PX = 70; // min horizontal distance to trigger back
const MAX_VERTICAL = 60; // max vertical drift to still count as horizontal
const AXIS_LOCK_PX = 8; // movement needed before deciding the gesture axis
const COMPLETE_MS = 200; // slide-off / spring-back duration

/**
 * Interactive edge-swipe back (Checkpoint 7c).
 *
 * The page now FOLLOWS the finger: dragging from the left edge translates
 * the route container in real time with a depth shadow; releasing past the
 * threshold slides it off-screen and navigates back (the previous page
 * renders instantly from the React Query caches), releasing early springs
 * it back. Same trigger zone and threshold as the previous no-feedback
 * implementation — only the visual feedback is new.
 */
export default function EdgeSwipeBack() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const el = document.getElementById("route-container");
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let axis: "none" | "horizontal" | "vertical" = "none";
    let lastDx = 0;
    let animating = false;

    const clearStyles = () => {
      el.style.transition = "";
      el.style.transform = "";
      el.style.boxShadow = "";
    };

    const resetGesture = () => {
      tracking = false;
      axis = "none";
      lastDx = 0;
    };

    const springBack = () => {
      el.style.transition = `transform ${COMPLETE_MS}ms ease-out`;
      el.style.transform = "translateX(0px)";
      window.setTimeout(() => {
        clearStyles();
        animating = false;
      }, COMPLETE_MS + 30);
    };

    const completeBack = () => {
      el.style.transition = `transform ${COMPLETE_MS}ms ease-out`;
      el.style.transform = `translateX(${window.innerWidth}px)`;
      window.setTimeout(() => {
        // Pages with an internal drill-down view (e.g. Profile's tabs, which
        // are local state rather than a route) close that view instead of
        // navigating the router — same slide-off feel either way.
        if (!invokePageBackHandler()) navigate(-1);
        // Clear on the next frame so the incoming page never renders
        // translated (one background-colored frame at most)
        requestAnimationFrame(() => {
          clearStyles();
          animating = false;
        });
        // Fallback in case rAF is throttled
        window.setTimeout(() => {
          clearStyles();
          animating = false;
        }, 80);
      }, COMPLETE_MS + 10);
    };

    const onStart = (e: TouchEvent) => {
      if (animating || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) return;
      // Root tabs have nowhere to swipe back to UNLESS they have an open
      // internal drill-down view (e.g. Profile's Countries/Map/etc. tabs).
      if (ROOT_PATHS.has(location.pathname) && !hasPageBackHandler()) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
      axis = "none";
      lastDx = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || animating) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (axis === "none") {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        if (axis === "vertical") {
          resetGesture();
          return;
        }
      }

      if (Math.abs(dy) > MAX_VERTICAL) {
        // Drifted vertical mid-gesture: cancel and spring back
        resetGesture();
        animating = true;
        springBack();
        return;
      }

      // Follow the finger (never left of the resting position)
      lastDx = Math.max(0, dx);
      // Keep the page from scrolling vertically while swiping back
      if (e.cancelable) e.preventDefault();
      el.style.transition = "none";
      el.style.transform = `translateX(${lastDx}px)`;
      el.style.boxShadow = "-8px 0 24px rgba(0,0,0,0.45)";
    };

    const onEnd = () => {
      if (!tracking) return;
      const dx = lastDx;
      const wasHorizontal = axis === "horizontal";
      resetGesture();

      if (!wasHorizontal || dx === 0) {
        clearStyles();
        return;
      }

      animating = true;
      if (dx >= THRESHOLD_PX) {
        completeBack();
      } else {
        springBack();
      }
    };

    const onCancel = () => {
      const hadTransform = axis === "horizontal" && lastDx > 0;
      resetGesture();
      if (hadTransform) {
        animating = true;
        springBack();
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
      clearStyles();
    };
  }, [location.pathname, navigate]);

  return null;
}
