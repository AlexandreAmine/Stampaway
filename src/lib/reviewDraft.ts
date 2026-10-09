import { supabase } from "@/integrations/supabase/client";
import { setCachedWishlistStatus } from "@/lib/wishlistCache";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";
import { invalidateExploreCache } from "@/lib/exploreCache";
import { clearRankingsCache } from "@/lib/placeRankings";

export interface TaggedUser {
  user_id: string;
  username: string;
  profile_picture: string | null;
}

/** Everything the rating form collects for one log. */
export interface ReviewDraft {
  rating: number;
  liked: boolean;
  reviewText: string;
  subRatings: Record<string, number>;
  visitYear: number | "";
  visitMonth: number | "";
  durationDays: number | "";
  taggedUsers: TaggedUser[];
}

export const emptyReviewDraft = (): ReviewDraft => ({
  rating: 0,
  liked: false,
  reviewText: "",
  subRatings: {},
  visitYear: "",
  visitMonth: "",
  durationDays: "",
  taggedUsers: [],
});

export interface SavedPlace {
  id: string;
  type: string;
}

/**
 * Saves one log exactly as the Add screen always has: the review row, then
 * in one parallel batch its tags and sub-ratings, removal from the wishlist
 * and ticking a matching yearly-goal place. `afterInsert` runs inside that
 * batch for caller-specific extras (the Add screen's favourite slot and
 * goal-progress toast). Returns the new review's id, or null if it failed.
 */
export async function saveReview(
  userId: string,
  place: SavedPlace,
  draft: ReviewDraft,
  afterInsert?: (reviewId: string | undefined) => Promise<unknown>
): Promise<string | null> {
  // Save year if selected; save month only if year is also selected
  const { visitYear, visitMonth } = draft;
  const hasYear = visitYear !== "";
  const hasMonth = visitMonth !== "";
  const { error, data: insertedReviews } = await supabase
    .from("reviews")
    .insert({
      user_id: userId,
      place_id: place.id,
      rating: draft.rating > 0 ? draft.rating : null,
      review_text: draft.reviewText || null,
      visit_year: hasYear ? visitYear : null,
      visit_month: hasYear && hasMonth ? visitMonth : null,
      duration_days: draft.durationDays || null,
      liked: draft.liked,
    })
    .select("id");
  if (error) return null;

  invalidateOwnProfileContentCache(userId);
  clearRankingsCache();
  invalidateExploreCache(userId);

  const reviewId = insertedReviews?.[0]?.id as string | undefined;
  const currentYear = new Date().getFullYear();

  // Auto-remove from wishlist if present
  const removeFromWishlist = async () => {
    const { error: wishlistError } = await supabase.from("wishlists").delete().eq("user_id", userId).eq("place_id", place.id);
    if (!wishlistError) {
      setCachedWishlistStatus(userId, place.id, false);
      invalidateOwnProfileContentCache(userId);
    }
  };

  // Auto-tick must-visit goal places
  const tickGoalPlace = async () => {
    await supabase
      .from("yearly_goal_places")
      .update({ completed: true })
      .eq("user_id", userId)
      .eq("place_id", place.id)
      .eq("year", currentYear)
      .eq("completed", false);
  };

  const saveTags = async () => {
    if (draft.taggedUsers.length === 0 || !reviewId) return;
    await supabase.from("review_tags").insert(
      draft.taggedUsers.map((tagged) => ({
        review_id: reviewId,
        tagged_user_id: tagged.user_id,
        tagged_by_user_id: userId,
      }))
    );
  };

  const saveSubRatings = async () => {
    const subEntries = Object.entries(draft.subRatings).filter(([, v]) => v > 0);
    if (subEntries.length === 0 || !reviewId) return;
    await supabase.from("review_sub_ratings").insert(
      subEntries.map(([category, rating]) => ({ review_id: reviewId, category, rating }))
    );
  };

  await Promise.all([
    removeFromWishlist(),
    tickGoalPlace(),
    saveTags(),
    saveSubRatings(),
    afterInsert ? afterInsert(reviewId) : Promise.resolve(),
  ]);

  return reviewId ?? "";
}
