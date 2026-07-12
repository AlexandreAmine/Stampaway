import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { StarRating } from "@/components/StarRating";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface TagEntry {
  review_id: string;
  tagged_by_user_id: string;
  created_at: string;
  place: { id: string; name: string; country: string; type: string; image: string | null } | null;
  review: { rating: number | null; visit_year: number | null; visit_month: number | null } | null;
  tagger: { username: string; profile_picture: string | null; user_id: string } | null;
}

export function TagsTab({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const viewerUserId = user?.id ?? null;

  // Cached by React Query: reopening this tab renders instantly from the
  // last known data while a background refetch keeps it fresh. The query key
  // replaces the previous manual request-context guards.
  const tagsQuery = useQuery({
    queryKey: ["profile-tags", userId ?? null, viewerUserId],
    enabled: !!userId,
    queryFn: async (): Promise<TagEntry[]> => {
      const { data, error } = await supabase
        .from("review_tags")
        .select("review_id, tagged_by_user_id, created_at")
        .eq("tagged_user_id", userId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const reviewIds = [...new Set(data.map((tag) => tag.review_id))];
      const taggerIds = [...new Set(data.map((tag) => tag.tagged_by_user_id))];

      const fetchReviewAndPlaceData = async () => {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("id, place_id, rating, visit_year, visit_month")
          .in("id", reviewIds);

        const placeIds = [...new Set((reviews || []).map((review) => review.place_id))];
        const { data: places } = await supabase
          .from("places")
          .select("id, name, country, type, image")
          .in("id", placeIds);

        return {
          reviews: reviews || [],
          places: places || [],
        };
      };

      const [reviewPlaceData, profilesResult] = await Promise.all([
        fetchReviewAndPlaceData(),
        supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", taggerIds),
      ]);

      const reviewMap = new Map(reviewPlaceData.reviews.map((review) => [review.id, review]));
      const placeMap = new Map(reviewPlaceData.places.map((place) => [place.id, place]));
      const profileMap = new Map(
        (profilesResult.data || []).map((profile) => [profile.user_id, profile])
      );

      return data.map((tag) => {
        const review = reviewMap.get(tag.review_id);
        const place = review ? placeMap.get(review.place_id) || null : null;
        return {
          review_id: tag.review_id,
          tagged_by_user_id: tag.tagged_by_user_id,
          created_at: tag.created_at,
          place,
          review: review
            ? {
                rating: review.rating,
                visit_year: review.visit_year,
                visit_month: review.visit_month,
              }
            : null,
          tagger: profileMap.get(tag.tagged_by_user_id) || null,
        };
      });
    },
  });
  const tags = tagsQuery.data ?? [];
  const loading = tagsQuery.isPending;

  if (loading) return <div className="text-center text-muted-foreground py-8 text-sm">Loading...</div>;
  if (tags.length === 0) return <div className="text-center text-muted-foreground py-8 text-sm">No tags yet</div>;

  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="space-y-3">
      {tags.map((tag) => (
        <button
          key={`${tag.review_id}-${tag.tagged_by_user_id}`}
          onClick={() => navigate(`/review/${tag.review_id}`)}
          className="w-full flex items-center gap-3 bg-card rounded-xl p-3 border border-border text-left"
        >
          {tag.place && (
            <div className="w-14 h-[72px] rounded-lg overflow-hidden shrink-0">
              <DestinationPoster
                placeId={tag.place.id}
                name={tag.place.name}
                country={tag.place.country}
                type={tag.place.type as "city" | "country"}
                image={tag.place.image}
                className="w-full h-full"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{tag.place?.name || "Unknown"}</p>
            {tag.review?.rating && (
              <StarRating rating={tag.review.rating} size={14} />
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-muted-foreground">Tagged by</span>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/profile/${tag.tagged_by_user_id}`); }}
                className="flex items-center gap-1"
              >
                <Avatar className="w-4 h-4">
                  {tag.tagger?.profile_picture ? (
                    <AvatarImage src={tag.tagger.profile_picture} />
                  ) : (
                    <AvatarFallback className="text-[8px]">{tag.tagger?.username?.[0]?.toUpperCase()}</AvatarFallback>
                  )}
                </Avatar>
                <span className="text-xs font-semibold text-foreground" data-no-translate>{tag.tagger?.username || "Unknown"}</span>
              </button>
            </div>
            {tag.review?.visit_year && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {tag.review.visit_month ? months[tag.review.visit_month] + " " : ""}{tag.review.visit_year}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
