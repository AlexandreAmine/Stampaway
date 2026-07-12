import { fetchAllTimeVisitorCountMap, fetchAllPlaces } from "@/lib/placeRankings";
import { sizedPosterUrl } from "@/lib/imageSizing";

let warmed = false;

/**
 * First-launch nicety: while the user is on Home, quietly pre-warm the
 * poster images of the top visited places into the HTTP cache, so the first
 * ever visit to Explore/Search shows its hero row instantly. Also warms the
 * rankings/places caches themselves as a side effect. Runs once per session,
 * during idle time, ~250 KB total at card rendition size.
 */
export function warmTrendingPosters() {
  if (warmed || typeof window === "undefined") return;
  warmed = true;

  const run = () => {
    void (async () => {
      try {
        const [countMap, places] = await Promise.all([
          fetchAllTimeVisitorCountMap(),
          fetchAllPlaces(),
        ]);
        const placeMap = new Map(places.map((p: any) => [p.id, p]));
        [...countMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([placeId]) => {
            const place = placeMap.get(placeId);
            const url = sizedPosterUrl(place?.image, 400);
            if (url) {
              const img = new Image();
              img.src = url;
            }
          });
      } catch {
        // Warm-up is best-effort only
      }
    })();
  };

  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback(run, { timeout: 8000 });
  } else {
    window.setTimeout(run, 3000);
  }
}
