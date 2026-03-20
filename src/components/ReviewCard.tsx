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
}

export function ReviewCard({ review, showImage = true }: ReviewCardProps) {
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

  return (
    <div className="bg-card rounded-2xl overflow-hidden">
      {showImage && placeImage && (
        <div className="relative h-48">
          <img src={placeImage} alt={placeName} className="w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3">
            <p className="text-lg font-bold text-foreground drop-shadow-lg">{placeName}</p>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-3">
          {userAvatar && (
            <img
              src={userAvatar}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{userName}</p>
            {rating != null && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-star fill-star" />
                <span className="text-xs font-medium text-foreground">{rating}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLike}
              className="flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  liked ? "text-red-500 fill-red-500" : "text-muted-foreground"
                }`}
              />
              {likeCount > 0 && (
                <span className="text-xs text-muted-foreground">{likeCount}</span>
              )}
            </button>
            <span className="text-xs text-muted-foreground">{createdAt}</span>
          </div>
        </div>
        {reviewText && (
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-3">{reviewText}</p>
        )}
      </div>
    </div>
  );
}
