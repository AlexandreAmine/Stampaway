import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "@/components/StarRating";

interface SubRating {
  category: string;
  rating: number;
}

interface SubRatingsDisplayProps {
  reviewId: string;
  compact?: boolean;
}

const CATEGORY_ORDER = [
  "Affordability",
  "Natural Beauty",
  "Culture & Heritage",
  "Safety & Security",
  "Food",
  "Hospitality & People",
  "Weather",
  "Entertainment & Nightlife",
];

const SHORT_LABELS: Record<string, string> = {
  "Affordability": "Afford.",
  "Natural Beauty": "Nature",
  "Culture & Heritage": "Culture",
  "Safety & Security": "Safety",
  "Food": "Food",
  "Hospitality & People": "People",
  "Weather": "Weather",
  "Entertainment & Nightlife": "Nightlife",
};

export function SubRatingsDisplay({ reviewId, compact = false }: SubRatingsDisplayProps) {
  const [subRatings, setSubRatings] = useState<SubRating[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("review_sub_ratings")
        .select("category, rating")
        .eq("review_id", reviewId);
      if (data && data.length > 0) {
        const sorted = CATEGORY_ORDER
          .map(cat => data.find(d => d.category === cat))
          .filter(Boolean) as SubRating[];
        setSubRatings(sorted);
      }
    })();
  }, [reviewId]);

  if (subRatings.length === 0) return null;

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {subRatings.map((sr) => (
          <div key={sr.category} className="flex items-center justify-between gap-1">
            <span className="text-[10px] text-muted-foreground truncate">{SHORT_LABELS[sr.category] || sr.category}</span>
            <div className="flex items-center gap-0.5">
              <StarRating rating={Number(sr.rating)} size={8} />
              <span className="text-[10px] font-semibold text-foreground">{sr.rating}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category Ratings</h4>
      <div className="grid gap-2">
        {subRatings.map((sr) => (
          <div key={sr.category} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{sr.category}</span>
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
  const [averages, setAverages] = useState<{ category: string; avg: number; count: number }[]>([]);
  const [myRatings, setMyRatings] = useState<SubRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Get all review IDs for this place
      const { data: reviews } = await supabase
        .from("reviews")
        .select("id, user_id")
        .eq("place_id", placeId);

      if (!reviews || reviews.length === 0) { setLoading(false); return; }

      const reviewIds = reviews.map(r => r.id);

      // Get all sub ratings for those reviews
      const { data: allSubs } = await supabase
        .from("review_sub_ratings")
        .select("review_id, category, rating")
        .in("review_id", reviewIds);

      if (!allSubs || allSubs.length === 0) { setLoading(false); return; }

      // Compute averages per category
      const catMap = new Map<string, number[]>();
      allSubs.forEach(s => {
        if (!catMap.has(s.category)) catMap.set(s.category, []);
        catMap.get(s.category)!.push(Number(s.rating));
      });

      const avgs = CATEGORY_ORDER
        .filter(cat => catMap.has(cat))
        .map(cat => {
          const vals = catMap.get(cat)!;
          return { category: cat, avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, count: vals.length };
        });
      setAverages(avgs);

      // Get my ratings
      if (userId) {
        const myReviewIds = reviews.filter(r => r.user_id === userId).map(r => r.id);
        if (myReviewIds.length > 0) {
          const mySubs = allSubs.filter(s => myReviewIds.includes(s.review_id));
          // Use latest review's sub ratings
          const latestReviewId = myReviewIds[myReviewIds.length - 1];
          setMyRatings(mySubs.filter(s => s.review_id === latestReviewId));
        }
      }

      setLoading(false);
    })();
  }, [placeId, userId]);

  if (loading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (averages.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No category ratings yet</p>;

  return (
    <div className="space-y-3">
      {averages.map(a => {
        const myR = myRatings.find(m => m.category === a.category);
        return (
          <div key={a.category} className="bg-card rounded-xl p-3 border border-border">
            <p className="text-xs font-semibold text-foreground mb-1.5">{a.category}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <StarRating rating={a.avg} size={12} />
                <span className="text-sm font-bold text-foreground">{a.avg}</span>
                <span className="text-[10px] text-muted-foreground">({a.count})</span>
              </div>
              {myR && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-primary font-medium">You:</span>
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
