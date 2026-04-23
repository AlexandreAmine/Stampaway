import { useState, useEffect } from "react";
import { Star, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
}

export function ReviewCard({ review, showImage = true, hidePlaceName = false }: ReviewCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [toggling, setToggling] = useState(false);

  const reviewId = review.id;
  const userName = review.userName || review.profile_username || "User";
  const userAvatar = review.userAvatar || review.profile_picture || "";
  const placeName = review.placeName || review.place_name || "";
  const placeImage = review.placeImage || review.place_image || "";
  const rating = review.rating;
  const reviewText = review.reviewText || review.review_text || "";
  const createdAt = review.createdAt || (review.created_at ? new Date(review.created_at).toLocaleDateString() : "");

  useEffect(() => {
    fetchLikes();
  }, [reviewId]);

  const fetchLikes = async () => {
    const { count } = await supabase
      .from("review_likes")
      .select("*", { count: "exact", head: true })
      .eq("review_id", reviewId);
    setLikeCount(count || 0);

    if (user) {
      const { data } = await supabase
        .from("review_likes")
        .select("id")
        .eq("review_id", reviewId)
        .eq("user_id", user.id)
        .maybeSingle();
      setLiked(!!data);
    }
  };

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || toggling) return;
    setToggling(true);
    if (liked) {
      await supabase
        .from("review_likes")
        .delete()
        .eq("review_id", reviewId)
        .eq("user_id", user.id);
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
    } else {
      await supabase
        .from("review_likes")
        .insert({ review_id: reviewId, user_id: user.id });
      setLiked(true);
      setLikeCount((c) => c + 1);
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
          {!hidePlaceName && placeName && <p className="text-sm font-semibold text-foreground mt-1">{placeName}</p>}
          {reviewText && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {reviewText.length > 800 ? reviewText.slice(0, 800) + "..." : reviewText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
