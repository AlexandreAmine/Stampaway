import { useEffect, useState } from "react";

/**
 * Returns false for the very first paint, true right after.
 *
 * Used to defer mounting heavyweight components (the Mapbox globes) until
 * the page shell — header, text, buttons — is already on screen, so cold
 * navigation paints instantly instead of competing with WebGL setup.
 *
 * Two rAFs = the browser has committed one frame. The timeout fallback
 * covers environments where rAF is throttled (hidden tab / backgrounded
 * launch), so the globe always mounts.
 */
export function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true));
    });
    const fallback = window.setTimeout(() => setReady(true), 500);

    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
      window.clearTimeout(fallback);
    };
  }, []);

  return ready;
}
