import "mapbox-gl/dist/mapbox-gl.css";
import type mapboxgl from "mapbox-gl";

/**
 * On-demand loader for mapbox-gl (Checkpoint 9, step 2).
 *
 * mapbox-gl's JS is ~1.75 MB — two thirds of the previous entry bundle —
 * and was parsed on the main thread on every cold launch before anything
 * rendered. Loading it dynamically keeps startup parse small; the import
 * below is warmed during idle right after launch, so by the time a globe
 * mounts (they mount after first paint) the module is usually ready.
 *
 * The CSS import above stays STATIC deliberately: the historically fragile
 * part of splitting mapbox in the iOS WebView was worker/CSS initialization,
 * so the stylesheet ships in the entry bundle and is always present before
 * any map is created. Both globes share this single module instance, so
 * accessToken and internal state behave exactly as before.
 */

type MapboxModule = typeof mapboxgl;

let modulePromise: Promise<MapboxModule> | null = null;

export function loadMapboxGl(): Promise<MapboxModule> {
  if (!modulePromise) {
    modulePromise = import("mapbox-gl").then(
      (m) => ((m as { default?: MapboxModule }).default ?? m) as MapboxModule
    );
  }
  return modulePromise;
}

// Warm the chunk during idle so globes never wait on it in practice.
if (typeof window !== "undefined") {
  const warm = () => {
    loadMapboxGl().catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback(warm, { timeout: 3000 });
  } else {
    window.setTimeout(warm, 1500);
  }
}
