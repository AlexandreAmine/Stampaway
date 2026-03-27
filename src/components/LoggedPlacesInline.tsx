import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { StarRating } from "@/components/StarRating";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SortOption = "your-highest" | "avg-highest" | "newest" | "longest";

const getSortLabels = (name?: string): Record<SortOption, string> => ({
  "your-highest": name ? `${name}'s highest first` : "Your highest first",
  "avg-highest": "Average highest first",
  "newest": "Newest visited first",
  "longest": "Highest total duration first",
});

interface PlaceEntry {
  place_id: string;
  rating: number | null;
  liked: boolean;
  visit_year: number | null;
  visit_month: number | null;
  duration_days: number | null;
  name: string;
  country: string;
  type: string;
  image: string | null;
  avg_rating?: number;
}

export function LoggedPlacesInline({ type, userId, ratingFilter, profileUsername }: { type: "city" | "country"; userId?: string; ratingFilter?: number; profileUsername?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [places, setPlaces] = useState<PlaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("your-highest");
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("place_id, rating, liked, visit_year, visit_month, duration_days, places!inner(name, country, type, image)")
        .eq("user_id", targetUserId)
        .eq("places.type", type)
        .order("created_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      const entries: PlaceEntry[] = data.map((r: any) => ({
        place_id: r.place_id,
        rating: r.rating != null ? Number(r.rating) : null,
        liked: r.liked || false,
        visit_year: r.visit_year,
        visit_month: r.visit_month,
        duration_days: r.duration_days,
        name: r.places.name,
        country: r.places.country,
        type: r.places.type,
        image: r.places.image,
      }));

      // Fetch average ratings for all these places
      const placeIds = [...new Set(entries.map((e) => e.place_id))];
      if (placeIds.length > 0) {
        const { data: allReviews } = await supabase
          .from("reviews")
          .select("place_id, rating")
          .in("place_id", placeIds);

        if (allReviews) {
          const avgMap: Record<string, { sum: number; count: number }> = {};
          allReviews.forEach((r: any) => {
            if (!avgMap[r.place_id]) avgMap[r.place_id] = { sum: 0, count: 0 };
            avgMap[r.place_id].sum += Number(r.rating);
            avgMap[r.place_id].count++;
          });
          entries.forEach((e) => {
            const a = avgMap[e.place_id];
            e.avg_rating = a ? a.sum / a.count : e.rating;
          });
        }
      }

      // Deduplicate: keep only the latest entry per place (data is ordered by created_at desc)
      const seen = new Set<string>();
      const deduped = entries.filter((e) => {
        if (seen.has(e.place_id)) return false;
        seen.add(e.place_id);
        return true;
      });

      setPlaces(deduped);
      setLoading(false);
    })();
  }, [targetUserId, type]);

  // Apply rating filter if provided
  const filtered = ratingFilter != null
    ? places.filter((p) => p.rating != null && p.rating === ratingFilter)
    : places;

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "your-highest": {
        // Null ratings go to bottom
        if (a.rating === null && b.rating === null) return 0;
        if (a.rating === null) return 1;
        if (b.rating === null) return -1;
        return b.rating - a.rating;
      }
      case "avg-highest":
        return (b.avg_rating ?? b.rating ?? 0) - (a.avg_rating ?? a.rating ?? 0);
      case "newest": {
        const ya = a.visit_year ?? 0, yb = b.visit_year ?? 0;
        if (yb !== ya) return yb - ya;
        return (b.visit_month ?? 0) - (a.visit_month ?? 0);
      }
      case "longest":
        return (b.duration_days ?? 0) - (a.duration_days ?? 0);
      default:
        return 0;
    }
  });

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (places.length === 0) return <div className="flex items-center justify-center h-40"><p className="text-sm text-muted-foreground">No {type === "city" ? "cities" : "countries"} logged yet</p></div>;
  if (ratingFilter != null && sorted.length === 0) return <div className="flex items-center justify-center h-40"><p className="text-sm text-muted-foreground">No {type === "city" ? "cities" : "countries"} with this rating</p></div>;

  const isOtherUser = !!userId && userId !== user?.id;
  const sortLabels = getSortLabels(isOtherUser ? profileUsername : undefined);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex justify-end mb-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground transition-colors">
            {sortLabels[sort]}
            <ChevronDown className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {(Object.keys(sortLabels) as SortOption[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setSort(key)}
                className={sort === key ? "text-primary font-semibold" : ""}
              >
                {sortLabels[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {sorted.map((r, i) => (
          <button key={r.place_id + i} onClick={() => navigate(`/place/${r.place_id}`)} className="relative text-left">
            <div className="aspect-[3/4] w-full">
              <DestinationPoster placeId={r.place_id} name={r.name} country={r.country} type={type} image={r.image} className="w-full h-full" />
            </div>
            {r.rating != null ? (
              <div className="mt-1.5 flex justify-center">
                <StarRating rating={r.rating} size={12} liked={r.liked} />
              </div>
            ) : (
              <p className="mt-1.5 text-[10px] text-muted-foreground text-center">No rating</p>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
