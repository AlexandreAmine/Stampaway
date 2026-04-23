import { useState, useEffect } from "react";
import { ChevronLeft, Heart, MessageSquare, Calendar, Clock, History } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DestinationPoster } from "@/components/DestinationPoster";
import { ReviewComments } from "@/components/ReviewComments";
import { SubRatingsDisplay } from "@/components/SubRatingsDisplay";
import { Linkify } from "@/components/Linkify";
import { useLocalizedPlaceName } from "@/hooks/useLocalizedPlaceName";

export default function ReviewDetailPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [review, setReview] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [place, setPlace] = useState<any>(null);
  const [pastLoggings, setPastLoggings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (reviewId) fetchReview();
  }, [reviewId]);

  const fetchReview = async () => {
    setLoading(true);

    const { data: reviewData } = await supabase
      .from("reviews")
      .select("*, places!inner(id, name, country, type, image)")
      .eq("id", reviewId)
      .maybeSingle();

    if (!reviewData) {
      setLoading(false);
      return;
    }

    setReview(reviewData);
    setPlace(reviewData.places);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("user_id, username, profile_picture")
      .eq("user_id", reviewData.user_id)
      .maybeSingle();

    setProfile(profileData);

    // Fetch past loggings of the same place by the same user
    const { data: allLoggings } = await supabase
      .from("reviews")
      .select("id, rating, liked, review_text, visit_year, visit_month, duration_days, created_at")
      .eq("user_id", reviewData.user_id)
      .eq("place_id", reviewData.place_id)
      .neq("id", reviewId!)
      .order("created_at", { ascending: false });

    setPastLoggings(allLoggings || []);
    setLoading(false);
  };

  const formatVisitDate = (r: any) => {
    if (!r?.visit_year) return null;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (r.visit_month) return `${months[r.visit_month - 1]} ${r.visit_year}`;
    return `${r.visit_year}`;
  };

  const localizedPlaceName = useLocalizedPlaceName(place?.name, place?.type === "country");

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-12 px-5 max-w-lg mx-auto">
        <div className="space-y-4">
          <div className="h-6 w-2/3 bg-muted/40 rounded animate-pulse" />
          <div className="h-4 w-1/3 bg-muted/40 rounded animate-pulse" />
          <div className="h-32 bg-muted/40 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!review || !place) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Review not found</p>
      </div>
    );
  }

  const visitDate = formatVisitDate(review);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <div className="relative h-52 w-full">
        <DestinationPoster
          placeId={place.id}
          name={place.name}
          country={place.country}
          type={place.type as "city" | "country"}
          image={place.image}
          autoGenerate
          className="w-full h-full rounded-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-12 left-5 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <div className="px-5 -mt-12 relative z-10">
        {/* User info */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate(profile?.user_id === user?.id ? "/profile" : `/profile/${profile?.user_id}`)}>
              <Avatar className="w-12 h-12 border-2 border-background">
                <AvatarImage src={profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.username || "?")}&background=3B82F6&color=fff`} />
                <AvatarFallback>{profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
            <div>
              <button onClick={() => navigate(profile?.user_id === user?.id ? "/profile" : `/profile/${profile?.user_id}`)} className="text-base font-semibold text-foreground hover:text-primary transition-colors">
                {profile?.username || "User"}
              </button>
              <p className="text-xs text-muted-foreground">
                logged <button onClick={() => navigate(`/place/${place.id}`)} className="text-primary hover:underline">{localizedPlaceName}</button>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Rating & liked */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="bg-card rounded-xl p-4 border border-border mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground">{review.rating ?? "—"}</span>
              <StarRating rating={review.rating || 0} size={16} liked={review.liked} />
            </div>
            {review.liked && (
              <div className="flex items-center gap-1.5 text-red-400">
                <Heart className="w-4 h-4 fill-current" />
                <span className="text-xs font-medium">Liked</span>
              </div>
            )}
          </div>

          {/* Visit details */}
          <div className="flex flex-wrap gap-3">
            {visitDate && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs">{visitDate}</span>
              </div>
            )}
            {review.duration_days && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs">{review.duration_days} {review.duration_days === 1 ? "day" : "days"}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Sub-category ratings */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }} className="mb-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <SubRatingsDisplay reviewId={reviewId!} />
          </div>
        </motion.div>

        {/* Review text */}
        {review.review_text && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Review</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed bg-card rounded-xl p-4 border border-border">
              {review.review_text}
            </p>
          </motion.div>
        )}

        {/* Past loggings */}
        {pastLoggings.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Previous visits</h3>
            </div>
            <div className="space-y-2">
              {pastLoggings.map((log) => {
                const logDate = formatVisitDate(log);
                return (
                  <button
                    key={log.id}
                    onClick={() => navigate(`/review/${log.id}`)}
                    className="bg-card rounded-xl p-3 border border-border w-full text-left active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <StarRating rating={log.rating || 0} size={12} liked={log.liked} />
                        <span className="text-sm font-semibold text-foreground">{log.rating ?? "—"}</span>
                        {log.liked && <Heart className="w-3 h-3 text-red-400 fill-current" />}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {logDate && (
                          <span className="text-[10px]">{logDate}</span>
                        )}
                        {log.duration_days && (
                          <span className="text-[10px]">{log.duration_days}d</span>
                        )}
                      </div>
                    </div>
                    {log.review_text && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{log.review_text}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Comments section */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-6">
          <ReviewComments reviewId={reviewId!} />
        </motion.div>
      </div>
    </div>
  );
}
