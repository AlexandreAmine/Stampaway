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

const SORT_LABELS: Record<SortOption, string> = {
  "your-highest": "Your highest first",
  "avg-highest": "Average highest first",
  "newest": "Newest visited first",
  "longest": "Highest total duration first",
};

interface PlaceEntry {
  place_id: string;
  rating: number;
  visit_year: number | null;
  visit_month: number | null;
  duration_days: number | null;
  name: string;
  country: string;
  type: string;
  image: string | null;
  avg_rating?: number;
}

export function LoggedPlacesInline({ type }: { type: "city" | "country" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [places, setPlaces] = useState<PlaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("your-highest");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("place_id, rating, visit_year, visit_month, duration_days, places!inner(name, country, type, image)")
        .eq("user_id", user.id)
        .eq("places.type", type)
        .order("created_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      const entries: PlaceEntry[] = data.map((r: any) => ({
        place_id: r.place_id,
        rating: Number(r.rating),
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

      setPlaces(entries);
      setLoading(false);
    })();
  }, [user, type]);

  const sorted = [...places].sort((a, b) => {
    switch (sort) {
      case "your-highest":
        return b.rating - a.rating;
      case "avg-highest":
        return (b.avg_rating ?? b.rating) - (a.avg_rating ?? a.rating);
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex justify-end mb-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground transition-colors">
            {SORT_LABELS[sort]}
            <ChevronDown className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setSort(key)}
                className={sort === key ? "text-primary font-semibold" : ""}
              >
                {SORT_LABELS[key]}
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
            <div className="mt-1.5 flex justify-center">
              <StarRating rating={r.rating} size={12} />
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
