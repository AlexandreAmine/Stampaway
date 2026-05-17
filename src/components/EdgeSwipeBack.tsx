import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
const THRESHOLD_PX = 70; // min horizontal distance
const MAX_VERTICAL = 60; // max vertical drift to still count as horizontal

export default function EdgeSwipeBack() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (t.clientX > EDGE_PX) return;
      if (ROOT_PATHS.has(location.pathname)) return;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx >= THRESHOLD_PX && dy <= MAX_VERTICAL) {
        navigate(-1);
      }
    };

    const onCancel = () => { tracking = false; };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [location.pathname, navigate]);

  return null;
}
