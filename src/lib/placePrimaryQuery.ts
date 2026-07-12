import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * PlacePage's primary data fetch, extracted so place cards can PREFETCH it
 * on touchstart (Instagram pattern): the ~100-150ms between finger-down and
 * navigation is spent loading, so the place page often renders instantly.
 * React Query dedupes the in-flight prefetch with the page's own query.
 */

export const placePrimaryQueryKey = (placeId: string | null, userId: string | null) =>
  ["place-primary", placeId, userId] as const;

export async function fetchPlacePrimary(placeId: string, userId: string | null) {
  const fetchWishlistStatus = async () => {
    if (!userId) return false;
    const { data } = await supabase
      .from("wishlists")
      .select("id")
      .eq("user_id", userId)
      .eq("place_id", placeId)
      .maybeSingle();
    return !!data;
  };

  // All queries only need the place id from the URL, so fire them in
  // parallel. Stats are aggregated server-side (get_place_stats) instead
  // of downloading every review row of the place.
  const [placeResult, nextInWishlist, statsResult, myReviewsResult, listItemsResult] = await Promise.all([
    supabase.from("places").select("*").eq("id", placeId).maybeSingle(),
    fetchWishlistStatus(),
    supabase.rpc("get_place_stats", { _place_id: placeId }),
    userId
      ? supabase
          .from("reviews")
          .select("id, rating, user_id, review_text, liked, created_at, visit_year, visit_month, duration_days")
          .eq("place_id", placeId)
          .eq("user_id", userId)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from("list_items")
      .select("list_id, lists!inner(id)")
      .eq("place_id", placeId),
  ]);

  if (statsResult.error) throw statsResult.error;

  return {
    placeData: placeResult.data as (Record<string, any> & { description?: string | null }) | null,
    nextInWishlist,
    stats: statsResult.data?.[0] ?? null,
    myReviews: myReviewsResult.data || [],
    listItemsCount: listItemsResult.data?.length || 0,
  };
}

/** Fire-and-forget prefetch for touchstart on place cards. */
export function prefetchPlacePrimary(
  queryClient: QueryClient,
  placeId: string,
  userId: string | null
) {
  void queryClient.prefetchQuery({
    queryKey: placePrimaryQueryKey(placeId, userId),
    queryFn: () => fetchPlacePrimary(placeId, userId),
    // Skip if we already have recent data (e.g. repeated presses)
    staleTime: 10_000,
  });
}
