import { useQuery } from "@tanstack/react-query";
import { StarRating } from "@/components/StarRating";
import { useLanguage } from "@/contexts/LanguageContext";
import { subCategoryLabel, subCategoryShortLabel } from "@/lib/subCategories";
import { fetchReviewSubRatings, reviewSubRatingsQueryKey } from "@/lib/reviewDetailQuery";
import { fetchPlaceCategoryStats } from "@/lib/placeCategoryStats";

interface SubRatingsDisplayProps {
  reviewId: string;
  compact?: boolean;
}

export function SubRatingsDisplay({ reviewId, compact = false }: SubRatingsDisplayProps) {
  const { t } = useLanguage();
  // Cached, so reopening a review shows its ratings at once (and opening one
  // from a list starts loading them on touch) instead of popping in.
  const { data: subRatings = [] } = useQuery({
    queryKey: reviewSubRatingsQueryKey(reviewId),
    queryFn: () => fetchReviewSubRatings(reviewId),
  });

  if (subRatings.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-0.5">
        {subRatings.map((sr) => (
          <div key={sr.category} className="flex items-center justify-between gap-1">
            <span className="text-[10px] text-muted-foreground truncate">{subCategoryShortLabel(sr.category, t)}</span>
            <span className="text-[10px] font-semibold text-foreground shrink-0">{sr.rating}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="label-caps">{t("review.categoryRatings")}</h4>
      <div className="grid gap-2">
        {subRatings.map((sr) => (
          <div key={sr.category} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{subCategoryLabel(sr.category, t)}</span>
            <div className="flex items-center gap-1.5">
              <StarRating rating={Number(sr.rating)} size={10} />
              <span className="text-xs font-semibold text-foreground">{sr.rating}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Average sub ratings for a place
interface PlaceCategoryRatingsProps {
  placeId: string;
  userId?: string;
}

export function PlaceCategoryRatings({ placeId, userId }: PlaceCategoryRatingsProps) {
  const { t } = useLanguage();
  // Cached, so coming back to this screen shows the ratings at once.
  const { data, isPending } = useQuery({
    queryKey: ["place-category-stats", placeId, userId ?? null],
    queryFn: () => fetchPlaceCategoryStats(placeId, userId),
  });
  const loading = isPending;
  const averages = data?.averages ?? [];
  const myRatings = data?.myRatings ?? [];

  if (loading) return (
    <div className="space-y-2 py-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-8 bg-muted/40 rounded-lg skeleton-shimmer" />
      ))}
    </div>
  );
  if (averages.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{t("review.noCategoryRatings")}</p>;

  return (
    <div className="space-y-3">
      {averages.map(a => {
        const myR = myRatings.find(m => m.category === a.category);
        return (
          <div key={a.category} className="bg-card rounded-xl p-3 border border-border">
            <p className="text-xs font-semibold text-foreground mb-1.5">{subCategoryLabel(a.category, t)}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StarRating rating={a.avg} size={12} />
                <span className="text-sm font-bold text-foreground">{a.avg}</span>
                <span className="text-[11px] text-muted-foreground">({a.count})</span>
              </div>
              {myR && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-primary font-medium">{t("review.youLabel")}</span>
                  <StarRating rating={Number(myR.rating)} size={10} />
                  <span className="text-xs font-semibold text-primary">{myR.rating}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
