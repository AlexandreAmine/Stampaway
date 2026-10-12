import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUB_CATEGORIES } from "@/lib/subCategories";

/**
 * Data for the review detail screen: the review with its place, the author,
 * and their other visits to the same place. Cached by React Query, so going
 * back to a review is instant; refetched on every open. Comments load
 * separately (ReviewComments) and are always live.
 */
export interface ReviewDetail {
  review: any;
  profile: { user_id: string; username: string; profile_picture: string | null } | null;
  pastLoggings: any[];
}

export const reviewDetailQueryKey = (reviewId: string | null) => ["review-detail", reviewId] as const;

/** null when the review doesn't exist (or isn't visible to this user). */
export async function fetchReviewDetail(reviewId: string): Promise<ReviewDetail | null> {
  const { data: review, error } = await supabase
    .from("reviews")
    .select("*, places!inner(id, name, country, type, image)")
    .eq("id", reviewId)
    .maybeSingle();
  if (error) throw error;
  if (!review) return null;

  const [profileResult, loggingsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, username, profile_picture")
      .eq("user_id", review.user_id)
      .maybeSingle(),
    supabase
      .from("reviews")
      .select("id, rating, liked, review_text, visit_year, visit_month, duration_days, created_at")
      .eq("user_id", review.user_id)
      .eq("place_id", review.place_id)
      .neq("id", reviewId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    review,
    profile: profileResult.error ? null : profileResult.data,
    pastLoggings: loggingsResult.error ? [] : loggingsResult.data || [],
  };
}

export interface SubRating {
  category: string;
  rating: number;
}

export const reviewSubRatingsQueryKey = (reviewId: string) => ["review-sub-ratings", reviewId] as const;

/** A review's category ratings, in the app's category order. */
export async function fetchReviewSubRatings(reviewId: string): Promise<SubRating[]> {
  const { data, error } = await supabase
    .from("review_sub_ratings")
    .select("category, rating")
    .eq("review_id", reviewId);
  if (error) throw error;
  return SUB_CATEGORIES.map((cat) => (data || []).find((d) => d.category === cat)).filter(Boolean) as SubRating[];
}

export interface ReviewComment {
  id: string;
  review_id: string;
  user_id: string;
  parent_id: string | null;
  comment_text: string;
  created_at: string;
  profile?: { username: string; profile_picture: string | null };
  replies?: ReviewComment[];
}

export const reviewCommentsQueryKey = (reviewId: string) => ["review-comments", reviewId] as const;

/** A review's comments as a thread (replies under their parent), oldest first. */
export async function fetchReviewComments(reviewId: string): Promise<ReviewComment[]> {
  const { data, error } = await supabase
    .from("review_comments")
    .select("*")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return [];

  const userIds = [...new Set(data.map((c) => c.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, username, profile_picture")
    .in("user_id", userIds);
  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

  const all: ReviewComment[] = data.map((c) => ({
    ...c,
    profile: profileMap.get(c.user_id) || undefined,
    replies: [],
  }));
  const topLevel: ReviewComment[] = [];
  const byId = new Map(all.map((c) => [c.id, c]));
  all.forEach((c) => {
    if (c.parent_id) {
      const parent = byId.get(c.parent_id);
      if (parent) parent.replies!.push(c);
    } else {
      topLevel.push(c);
    }
  });
  return topLevel;
}

/** Start loading a review when a finger lands on a link to it. */
export function prefetchReviewDetail(queryClient: QueryClient, reviewId: string) {
  void queryClient.prefetchQuery({
    queryKey: reviewDetailQueryKey(reviewId),
    queryFn: () => fetchReviewDetail(reviewId),
    staleTime: 10_000,
  });
  void queryClient.prefetchQuery({
    queryKey: reviewSubRatingsQueryKey(reviewId),
    queryFn: () => fetchReviewSubRatings(reviewId),
    staleTime: 10_000,
  });
  void queryClient.prefetchQuery({
    queryKey: reviewCommentsQueryKey(reviewId),
    queryFn: () => fetchReviewComments(reviewId),
    staleTime: 10_000,
  });
}

/** Spread onto anything that opens a review, so PressPrefetch can preload it. */
export function reviewLinkProps(reviewId: string | null | undefined) {
  return reviewId ? { "data-prefetch-review": reviewId } : {};
}
