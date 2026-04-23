import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { DestinationPoster } from "@/components/DestinationPoster";
import { dedupeByNewest } from "@/lib/reviewDedup";

interface ReviewEntry {
  id: string;
  rating: number;
  review_text: string;
  created_at: string;
  place: {
    id: string;
    name: string;
    country: string;
    type: string;
    image: string | null;
  };
}

export function ReviewsTab({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, review_text, created_at, visit_year, visit_month, places!inner(id, name, country, type, image)")
        .eq("user_id", targetUserId)
        .not("review_text", "is", null)
        .neq("review_text", "")
        .order("created_at", { ascending: false });

      if (data) {
        const all = data.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          review_text: r.review_text,
          created_at: r.created_at,
          visit_year: r.visit_year,
          visit_month: r.visit_month,
          place: { id: r.places.id, name: r.places.name, country: r.places.country, type: r.places.type, image: r.places.image },
        }));
        // Deduplicate per place - keep newest visit date entry
        setReviews(dedupeByNewest(all, (r) => r.place.id));
      }
      setLoading(false);
    })();
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-muted/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground text-sm">No reviews written yet</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {reviews.map((r) => (
        <button
          key={r.id}
          onClick={() => navigate(`/place/${r.place.id}`)}
          className="flex gap-3 bg-card rounded-xl p-3 border border-border w-full text-left"
        >
          <div className="w-14 h-[72px] shrink-0 rounded-lg overflow-hidden">
            <DestinationPoster
              placeId={r.place.id}
              name={r.place.name}
              country={r.place.country}
              type={r.place.type as "city" | "country"}
              image={r.place.image}
              className="w-full h-full"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{r.place.name}</p>
            <div className="mt-0.5">
              <StarRating rating={r.rating} size={12} />
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{r.review_text.length > 800 ? r.review_text.slice(0, 800) + "..." : r.review_text}</p>
          </div>
        </button>
      ))}
    </motion.div>
  );
}
