import { fallbackAvatarUrl } from "@/lib/avatarFallback";
import { slideBack } from "@/lib/backTransition";
import { placeLinkProps } from "@/lib/placePrimaryQuery";
import { reviewLinkProps } from "@/lib/reviewDetailQuery";
import { profileLinkProps } from "@/lib/profileHeaderQuery";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReviewDetail, reviewDetailQueryKey } from "@/lib/reviewDetailQuery";
import { monthShortNames } from "@/lib/localeFormat";
import { ChevronLeft, Heart, MessageSquare, Calendar, Clock, History } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { StarRating } from "@/components/StarRating";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DestinationPoster } from "@/components/DestinationPoster";
import { ReviewComments } from "@/components/ReviewComments";
import { SubRatingsDisplay } from "@/components/SubRatingsDisplay";
import { Linkify } from "@/components/Linkify";
import { ReviewActionsMenu } from "@/components/ReviewActionsMenu";
import { useLocalizedPlaceName } from "@/hooks/useLocalizedPlaceName";
import { ProfilePicturePreview } from "@/components/ProfilePicturePreview";

export default function ReviewDetailPage() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const [previewOpen, setPreviewOpen] = useState(false);

  // Cached (instant when going back, or when the card was pressed and the
  // data prefetched) and refetched on every open.
  const detailQuery = useQuery({
    queryKey: reviewDetailQueryKey(reviewId ?? null),
    enabled: !!reviewId,
    queryFn: () => fetchReviewDetail(reviewId!),
  });
  const review = detailQuery.data?.review ?? null;
  const profile = detailQuery.data?.profile ?? null;
  const place = review?.places ?? null;
  const pastLoggings = detailQuery.data?.pastLoggings ?? [];
  const loading = detailQuery.isPending && !!reviewId;
  const months = monthShortNames(language);

  const formatVisitDate = (r: any) => {
    if (!r?.visit_year) return null;
    if (r.visit_month) return `${months[r.visit_month - 1]} ${r.visit_year}`;
    return `${r.visit_year}`;
  };

  const localizedPlaceName = useLocalizedPlaceName(place?.name, place?.type === "country");

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-12 px-5 max-w-lg mx-auto">
        <div className="space-y-4">
          <div className="h-6 w-2/3 bg-muted/40 rounded skeleton-shimmer" />
          <div className="h-4 w-1/3 bg-muted/40 rounded skeleton-shimmer" />
          <div className="h-32 bg-muted/40 rounded-xl skeleton-shimmer" />
        </div>
      </div>
    );
  }

  if (!review || !place) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("reviewDetail.notFound")}</p>
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
          renderWidth={900}
          className="w-full h-full rounded-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <button
          onClick={() => slideBack(() => navigate(-1))}
          className="absolute top-12 left-5 w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        {user && review.user_id !== user.id && (
          <div className="absolute top-12 right-5">
            <ReviewActionsMenu reviewId={review.id} reviewUserId={review.user_id} />
          </div>
        )}
      </div>

      <div className="px-5 -mt-12 relative z-10">
        {/* User info */}
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setPreviewOpen(true)}>
              <Avatar className="w-12 h-12 border-2 border-background">
                <AvatarImage
                  src={profile?.profile_picture || fallbackAvatarUrl(profile?.username || "?")}
                  draggable={false}
                  onContextMenu={(e: any) => e.preventDefault()}
                  style={{ WebkitTouchCallout: "none" }}
                />
                <AvatarFallback>{profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
            </button>
            <div>
              <button onClick={() => navigate(profile?.user_id === user?.id ? "/profile" : `/profile/${profile?.user_id}`)} {...profileLinkProps(profile?.user_id, profile?.username, profile?.profile_picture)} className="text-base font-semibold text-foreground hover:text-primary transition-colors">
                {profile?.username || "User"}
              </button>
              <p className="text-xs text-muted-foreground">
                logged <button onClick={() => navigate(`/place/${place.id}`)} {...placeLinkProps(place.id)} className="text-primary hover:underline">{localizedPlaceName}</button>
              </p>
            </div>
          </div>
        </motion.div>

        {/* Rating & liked */}
        <motion.div initial={false} animate={{ opacity: 1 }} className="bg-card rounded-xl p-4 border border-border mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-foreground">{review.rating ?? "—"}</span>
              <StarRating rating={review.rating || 0} size={16} liked={review.liked} />
            </div>
            {review.liked && (
              <div className="flex items-center gap-1.5 text-red-400">
                <Heart className="w-4 h-4 fill-current" />
                <span className="text-xs font-medium">{t("reviewDetail.liked")}</span>
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
        <motion.div initial={false} animate={{ opacity: 1 }} className="mb-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <SubRatingsDisplay reviewId={reviewId!} />
          </div>
        </motion.div>

        {/* Review text */}
        {review.review_text && (
          <motion.div initial={false} animate={{ opacity: 1 }} className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("reviewDetail.review")}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed bg-card rounded-xl p-4 border border-border whitespace-pre-wrap break-words">
              <span data-no-translate><Linkify text={review.review_text} /></span>
            </p>
          </motion.div>
        )}

        {/* Past loggings */}
        {pastLoggings.length > 0 && (
          <motion.div initial={false} animate={{ opacity: 1 }} className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{t("reviewDetail.previousVisits")}</h3>
            </div>
            <div className="space-y-2">
              {pastLoggings.map((log) => {
                const logDate = formatVisitDate(log);
                return (
                  <button
                    key={log.id}
                    onClick={() => navigate(`/review/${log.id}`)}
                    {...reviewLinkProps(log.id)}
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
                          <span className="text-[11px]">{logDate}</span>
                        )}
                        {log.duration_days && (
                          <span className="text-[11px]">{log.duration_days}d</span>
                        )}
                      </div>
                    </div>
                    {log.review_text && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1" data-no-translate>{log.review_text}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Comments section */}
        <motion.div initial={false} animate={{ opacity: 1 }} className="mt-6">
          <ReviewComments reviewId={reviewId!} />
        </motion.div>
      </div>
      <ProfilePicturePreview
        src={profile?.profile_picture || fallbackAvatarUrl(profile?.username || "?")}
        alt={profile?.username || "User"}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
