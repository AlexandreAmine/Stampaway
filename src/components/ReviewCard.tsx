import { useState, useEffect, useRef } from "react";
import { Star, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";

interface ReviewCardProps {
  review: {
    id: string;
    userName?: string;
    userAvatar?: string;
    userId?: string;
    user_id?: string;
    placeName?: string;
    placeImage?: string;
    place_id?: string;
    placeId?: string;
    rating?: number | null;
    reviewText?: string;
    review_text?: string;
    createdAt?: string;
    created_at?: string;
    // enriched fields from DB queries
    profile_username?: string;
    profile_picture?: string;
    place_name?: string;
    place_image?: string;
  };
  showImage?: boolean;
  hidePlaceName?: boolean;
  initialLikeCount?: number;
  initialLikedByCurrentUser?: boolean;
  likeDataStatus?: "unavailable" | "loading" | "ready";
}

type ReviewLikeState = {
  reviewId: string;
  likeCount: number;
  liked: boolean;
};

const getInitialLikeState = (
  reviewId: string,
  initialLikeCount?: number,
  initialLikedByCurrentUser?: boolean
): ReviewLikeState => ({
  reviewId,
  likeCount: typeof initialLikeCount === "number" ? initialLikeCount : 0,
  liked: typeof initialLikedByCurrentUser === "boolean" ? initialLikedByCurrentUser : false,
});

export function ReviewCard({
  review,
  showImage = true,
  hidePlaceName = false,
  initialLikeCount,
  initialLikedByCurrentUser,
  likeDataStatus = "unavailable",
}: ReviewCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reviewId = review.id;
  const hasInitialLikeCount = likeDataStatus === "ready" && typeof initialLikeCount === "number";
  const hasInitialLikedByCurrentUser = likeDataStatus === "ready" && typeof initialLikedByCurrentUser === "boolean";
  const [likeState, setLikeState] = useState(() =>
    getInitialLikeState(
      reviewId,
      hasInitialLikeCount ? initialLikeCount : undefined,
      hasInitialLikedByCurrentUser ? initialLikedByCurrentUser : undefined
    )
  );
  const [toggling, setToggling] = useState(false);
  const localMutationReviewIdRef = useRef<string | null>(null);
  const userName = review.userName || review.profile_username || "User";
  const userAvatar = review.userAvatar || review.profile_picture || "";
  const placeName = review.placeName || review.place_name || "";
  const placeImage = review.placeImage || review.place_image || "";
  const rating = review.rating;
  const reviewText = review.reviewText || review.review_text || "";
  const createdAt = review.createdAt || (review.created_at ? new Date(review.created_at).toLocaleDateString() : "");
  const currentLikeState = likeState.reviewId === reviewId
    ? likeState
    : getInitialLikeState(
        reviewId,
        hasInitialLikeCount ? initialLikeCount : undefined,
        hasInitialLikedByCurrentUser ? initialLikedByCurrentUser : undefined
      );
  const likeCount = currentLikeState.likeCount;
  const liked = currentLikeState.liked;

  useEffect(() => {
    localMutationReviewIdRef.current = null;
    setLikeState(
      getInitialLikeState(
        reviewId,
        hasInitialLikeCount ? initialLikeCount : undefined,
        hasInitialLikedByCurrentUser ? initialLikedByCurrentUser : undefined
      )
    );
  }, [reviewId, user?.id]);

  useEffect(() => {
    if (likeDataStatus !== "ready") return;
    if (!hasInitialLikeCount && !hasInitialLikedByCurrentUser) return;
    if (localMutationReviewIdRef.current === reviewId) return;

    setLikeState((prev) => {
      const base = prev.reviewId === reviewId ? prev : getInitialLikeState(reviewId);
      return {
        reviewId,
        likeCount: hasInitialLikeCount ? initialLikeCount : base.likeCount,
        liked: hasInitialLikedByCurrentUser ? initialLikedByCurrentUser : base.liked,
      };
    });
  }, [
    reviewId,
    likeDataStatus,
    hasInitialLikeCount,
    initialLikeCount,
    hasInitialLikedByCurrentUser,
    initialLikedByCurrentUser,
  ]);

  useEffect(() => {
    const needsLikeCount = !hasInitialLikeCount;
    const needsLikedByCurrentUser = !hasInitialLikedByCurrentUser;
    if (likeDataStatus === "loading") return;
    if (!needsLikeCount && !needsLikedByCurrentUser) return;
    if (localMutationReviewIdRef.current === reviewId) return;

    let cancelled = false;
    const requestReviewId = reviewId;
    const requestUserId = user?.id ?? null;

    const applyFetchedState = (partial: Partial<Omit<ReviewLikeState, "reviewId">>) => {
      if (cancelled || localMutationReviewIdRef.current === requestReviewId) return;
      setLikeState((prev) => {
        const base = prev.reviewId === requestReviewId ? prev : getInitialLikeState(requestReviewId);
        return { ...base, ...partial, reviewId: requestReviewId };
      });
    };

    const fetchMissingLikes = async () => {
      if (needsLikeCount) {
        const { count } = await supabase
          .from("review_likes")
          .select("*", { count: "exact", head: true })
          .eq("review_id", requestReviewId);
        applyFetchedState({ likeCount: count || 0 });
      }

      if (!needsLikedByCurrentUser || !requestUserId) return;

      const { data } = await supabase
        .from("review_likes")
        .select("id")
        .eq("review_id", requestReviewId)
        .eq("user_id", requestUserId)
        .maybeSingle();
      applyFetchedState({ liked: !!data });
    };

    fetchMissingLikes();
    return () => { cancelled = true; };
  }, [reviewId, user?.id, likeDataStatus, hasInitialLikeCount, hasInitialLikedByCurrentUser]);

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || toggling) return;
    setToggling(true);
    if (liked) {
      const { error } = await supabase
        .from("review_likes")
        .delete()
        .eq("review_id", reviewId)
        .eq("user_id", user.id);
      if (!error) invalidateOwnProfileContentCache(user.id);
      localMutationReviewIdRef.current = reviewId;
      setLikeState((prev) => {
        const base = prev.reviewId === reviewId ? prev : getInitialLikeState(reviewId, likeCount, liked);
        return { ...base, reviewId, liked: false, likeCount: Math.max(0, base.likeCount - 1) };
      });
    } else {
      const { error } = await supabase
        .from("review_likes")
        .insert({ review_id: reviewId, user_id: user.id });
      if (!error) invalidateOwnProfileContentCache(user.id);
      localMutationReviewIdRef.current = reviewId;
      setLikeState((prev) => {
        const base = prev.reviewId === reviewId ? prev : getInitialLikeState(reviewId, likeCount, liked);
        return { ...base, reviewId, liked: true, likeCount: base.likeCount + 1 };
      });
    }
    setToggling(false);
  };

  const placeId = review.place_id || review.placeId || "";
  const userId = review.userId || review.user_id || "";

  return (
    <div
      className="bg-card rounded-xl p-3 border border-border cursor-pointer"
      onClick={() => reviewId && navigate(`/review/${reviewId}`)}
    >
      <div className="flex items-start gap-3">
        {showImage && placeImage && (
          <img src={placeImage} alt={placeName} loading="lazy" decoding="async" width={48} height={48} className="w-12 h-12 rounded-lg object-cover shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {userAvatar && (
                <img
                  src={userAvatar}
                  alt={userName}
                  className="w-5 h-5 rounded-full object-cover shrink-0 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); if (userId) navigate(userId === user?.id ? "/profile" : `/profile/${userId}`); }}
                />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); if (userId) navigate(userId === user?.id ? "/profile" : `/profile/${userId}`); }}
                className="text-xs font-medium text-muted-foreground truncate hover:underline"
              >
                {userName}
              </button>
              {rating != null && (
                <>
                  <Star className="w-3 h-3 text-star fill-star shrink-0" />
                  <span className="text-xs font-semibold text-foreground">{rating}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleLike}
                className="flex items-center gap-1 active:scale-95 transition-transform"
              >
                <Heart
                  className={`w-3.5 h-3.5 transition-colors ${
                    liked ? "text-red-500 fill-red-500" : "text-muted-foreground"
                  }`}
                />
                {likeCount > 0 && (
                  <span className="text-xs text-muted-foreground">{likeCount}</span>
                )}
              </button>
            </div>
          </div>
          {!hidePlaceName && placeName && <p className="text-sm font-semibold text-foreground mt-1" data-no-translate>{placeName}</p>}
          {reviewText && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2" data-no-translate>
              {reviewText.length > 800 ? reviewText.slice(0, 800) + "..." : reviewText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
