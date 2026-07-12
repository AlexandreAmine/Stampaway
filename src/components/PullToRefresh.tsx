import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { hapticLight, hapticMedium } from "@/lib/haptics";

const PULL_THRESHOLD = 70; // px of (damped) pull needed to trigger
const MAX_PULL = 110; // px cap so the indicator can't be dragged forever
const DAMPING = 0.45; // finger distance → indicator distance
const MIN_SPIN_MS = 500; // keep the spinner visible long enough to register

interface PullToRefreshProps {
  /** Kicks off the refresh; the spinner stays until the promise settles. */
  onRefresh: () => Promise<unknown>;
}

/**
 * Instagram-style pull-to-refresh: a floating spinner bubble that rides down
 * from under the notch while the user pulls from the very top of the page,
 * triggers with a haptic at the threshold, and spins until the refresh
 * settles. Listens on window (pages scroll the window in this app) and only
 * engages when the page is scrolled to the top, so normal scrolling is
 * completely unaffected.
 */
export function PullToRefresh({ onRefresh }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const firedHapticRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const setPullBoth = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };

    const reset = () => {
      startYRef.current = null;
      setDragging(false);
      if (!refreshingRef.current) setPullBoth(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || e.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      startYRef.current = e.touches[0].clientY;
      firedHapticRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current !== 0) setPullBoth(0);
        return;
      }
      setDragging(true);
      const damped = Math.min(dy * DAMPING, MAX_PULL);
      setPullBoth(damped);
      if (damped >= PULL_THRESHOLD && !firedHapticRef.current) {
        firedHapticRef.current = true;
        hapticMedium();
      }
    };

    const onTouchEnd = () => {
      if (startYRef.current === null || refreshingRef.current) {
        reset();
        return;
      }
      const triggered = pullRef.current >= PULL_THRESHOLD;
      startYRef.current = null;
      setDragging(false);

      if (!triggered) {
        setPullBoth(0);
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      setPullBoth(PULL_THRESHOLD);

      const started = Date.now();
      Promise.resolve()
        .then(() => onRefreshRef.current())
        .catch(() => {})
        .then(() => {
          const elapsed = Date.now() - started;
          const settle = () => {
            refreshingRef.current = false;
            setRefreshing(false);
            setPullBoth(0);
            // Soft tick confirming the refresh finished
            hapticLight();
          };
          if (elapsed >= MIN_SPIN_MS) settle();
          else window.setTimeout(settle, MIN_SPIN_MS - elapsed);
        });
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, []);

  const visible = pull > 4 || refreshing;
  const progress = Math.min(pull / PULL_THRESHOLD, 1);

  return (
    <div
      aria-hidden
      className="fixed left-1/2 z-40 pointer-events-none"
      style={{
        top: "calc(env(safe-area-inset-top) + 8px)",
        transform: `translate(-50%, ${visible ? pull - 44 : -60}px)`,
        opacity: visible ? Math.max(progress, refreshing ? 1 : 0) : 0,
        transition: dragging ? "none" : "transform 200ms ease-out, opacity 200ms ease-out",
      }}
    >
      <div className="w-9 h-9 rounded-full bg-card border border-border shadow-lg flex items-center justify-center">
        <Loader2
          className={`w-4 h-4 text-primary ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </div>
    </div>
  );
}
