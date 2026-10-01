import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { prefetchPlacePrimary } from "@/lib/placePrimaryQuery";
import { prefetchProfileHeader } from "@/lib/profileHeaderQuery";
import { prefetchReviewDetail } from "@/lib/reviewDetailQuery";

/**
 * Starts loading a place, profile or review the moment a finger lands on a link to
 * it — about 100–300 ms before the tap completes and navigation begins — so
 * the next screen usually opens with its data ready.
 *
 * One listener for the whole app instead of a handler per card: posters mark
 * themselves with data-prefetch-place (DestinationPoster), profile links with
 * profileLinkProps(), review links with reviewLinkProps(). The closest marked
 * element wins, so a poster inside a review card preloads the place. Scrolls
 * also start with a touch, so this may prefetch the one item under the
 * finger; that is cheap and deduplicated.
 */
export default function PressPrefetch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const onTouchStart = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const el = target?.closest<HTMLElement>("[data-prefetch-place],[data-prefetch-profile],[data-prefetch-review]");
      if (!el) return;

      const reviewId = el.dataset.prefetchReview;
      if (reviewId) {
        prefetchReviewDetail(queryClient, reviewId);
        return;
      }

      const placeId = el.dataset.prefetchPlace;
      if (placeId) {
        prefetchPlacePrimary(queryClient, placeId, userId);
        return;
      }

      const profileId = el.dataset.prefetchProfile;
      if (profileId && profileId !== userId) {
        prefetchProfileHeader(queryClient, profileId, {
          username: el.dataset.profileName || undefined,
          profile_picture: el.dataset.profilePic || null,
        });
      }
    };
    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    return () => document.removeEventListener("touchstart", onTouchStart, { capture: true });
  }, [queryClient, userId]);

  return null;
}
