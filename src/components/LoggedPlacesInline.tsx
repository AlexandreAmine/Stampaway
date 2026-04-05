import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { PosterWishlistButton } from "@/components/PosterWishlistButton";
import { dedupeByNewest } from "@/lib/reviewDedup";
import { StarRating } from "@/components/StarRating";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategorySortDropdown, type SubRatingCategory } from "@/components/CategorySortDropdown";
import {
  EUROPE_COUNTRIES, ASIA_COUNTRIES, NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA_COUNTRIES, AFRICA_COUNTRIES, OCEANIA_COUNTRIES,
} from "@/lib/continents";

type SortOption = "your-highest" | "category-highest" | "avg-highest" | "avg-category-highest" | "newest" | "longest";

const CONTINENT_ORDER = ["Europe", "Asia", "North America", "South America", "Africa", "Oceania", "Other"];

function getContinent(country: string): string {
  if (EUROPE_COUNTRIES.includes(country)) return "Europe";
  if (ASIA_COUNTRIES.includes(country)) return "Asia";
  if (NORTH_AMERICA_COUNTRIES.includes(country)) return "North America";
  if (SOUTH_AMERICA_COUNTRIES.includes(country)) return "South America";
  if (AFRICA_COUNTRIES.includes(country)) return "Africa";
  if (OCEANIA_COUNTRIES.includes(country)) return "Oceania";
  return "Other";
}

const getSortLabels = (name?: string): Record<SortOption, string> => ({
  "your-highest": name ? `${name}'s highest first` : "Your highest first",
  "category-highest": name ? `${name}'s categories highest first` : "Your categories highest first",
  "avg-highest": "Average highest first",
  "avg-category-highest": "Average categories highest first",
  "newest": name ? `${name}'s newest visited first` : "Newest visited first",
  "longest": name ? `${name}'s highest total duration first` : "Highest total duration first",
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
  _catRating?: number;
  _avgCatRating?: number;
}

export function LoggedPlacesInline({ type, userId, ratingFilter, profileUsername }: { type: "city" | "country"; userId?: string; ratingFilter?: number; profileUsername?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [places, setPlaces] = useState<PlaceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("your-highest");
  const [selectedCategory, setSelectedCategory] = useState<SubRatingCategory>("Natural Beauty");
  const [avgSelectedCategory, setAvgSelectedCategory] = useState<SubRatingCategory>("Natural Beauty");
  const [grouped, setGrouped] = useState(false);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, place_id, rating, liked, visit_year, visit_month, duration_days, created_at, places!inner(name, country, type, image)")
        .eq("user_id", targetUserId)
        .eq("places.type", type)
        .order("created_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      const allEntries: (PlaceEntry & { review_id: string; created_at: string })[] = data.map((r: any) => ({
        review_id: r.id,
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
        created_at: r.created_at || "",
      }));

      // Deduplicate: keep newest visit date per place
      const entries = dedupeByNewest(allEntries, (e) => e.place_id);

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
            e.avg_rating = a ? a.sum / a.count : e.rating ?? undefined;
          });
        }
      }

      setPlaces(entries);
      setLoading(false);
    })();
  }, [targetUserId, type]);

  // Fetch user's category ratings
  useEffect(() => {
    if (sort !== "category-highest" || places.length === 0 || !targetUserId) return;
    (async () => {
      const placeIds = places.map((p) => p.place_id);
      const { data: userReviews } = await supabase
        .from("reviews")
        .select("id, place_id")
        .eq("user_id", targetUserId)
        .in("place_id", placeIds);
      if (!userReviews || userReviews.length === 0) return;

      const reviewIds = userReviews.map((r) => r.id);
      const reviewPlaceMap = new Map(userReviews.map((r) => [r.id, r.place_id]));

      const { data: subRatings } = await supabase
        .from("review_sub_ratings")
        .select("review_id, category, rating")
        .in("review_id", reviewIds)
        .eq("category", selectedCategory);

      const catMap: Record<string, number> = {};
      (subRatings || []).forEach((sr: any) => {
        const pid = reviewPlaceMap.get(sr.review_id);
        if (pid) catMap[pid] = Number(sr.rating);
      });

      setPlaces((prev) => prev.map((p) => ({ ...p, _catRating: catMap[p.place_id] ?? 0 })));
    })();
  }, [sort, selectedCategory, places.length, targetUserId]);

  // Fetch average category ratings (all users)
  useEffect(() => {
    if (sort !== "avg-category-highest" || places.length === 0) return;
    (async () => {
      const placeIds = places.map((p) => p.place_id);
      const { data: allReviews } = await supabase
        .from("reviews")
        .select("id, place_id")
        .in("place_id", placeIds);
      if (!allReviews || allReviews.length === 0) return;

      const reviewIds = allReviews.map((r) => r.id);
      const reviewPlaceMap = new Map(allReviews.map((r) => [r.id, r.place_id]));

      const { data: subRatings } = await supabase
        .from("review_sub_ratings")
        .select("review_id, category, rating")
        .in("review_id", reviewIds)
        .eq("category", avgSelectedCategory);

      const catMap: Record<string, { sum: number; count: number }> = {};
      (subRatings || []).forEach((sr: any) => {
        const pid = reviewPlaceMap.get(sr.review_id);
        if (!pid) return;
        if (!catMap[pid]) catMap[pid] = { sum: 0, count: 0 };
        catMap[pid].sum += Number(sr.rating);
        catMap[pid].count++;
      });

      setPlaces((prev) => prev.map((p) => {
        const a = catMap[p.place_id];
        return { ...p, _avgCatRating: a ? a.sum / a.count : 0 };
      }));
    })();
  }, [sort, avgSelectedCategory, places.length]);

  const filtered = ratingFilter != null
    ? places.filter((p) => p.rating != null && p.rating === ratingFilter)
    : places;

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "your-highest":
        if (a.rating === null && b.rating === null) return 0;
        if (a.rating === null) return 1;
        if (b.rating === null) return -1;
        return b.rating - a.rating;
      case "avg-highest":
        return (b.avg_rating ?? b.rating ?? 0) - (a.avg_rating ?? a.rating ?? 0);
      case "newest": {
        const ya = a.visit_year ?? 0, yb = b.visit_year ?? 0;
        if (yb !== ya) return yb - ya;
        return (b.visit_month ?? 0) - (a.visit_month ?? 0);
      }
      case "longest":
        return (b.duration_days ?? 0) - (a.duration_days ?? 0);
      case "category-highest":
        return (b._catRating ?? 0) - (a._catRating ?? 0);
      case "avg-category-highest":
        return (b._avgCatRating ?? 0) - (a._avgCatRating ?? 0);
      default:
        return 0;
    }
  });

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (places.length === 0) return <div className="flex items-center justify-center h-40"><p className="text-sm text-muted-foreground">No {type === "city" ? "cities" : "countries"} logged yet</p></div>;
  if (ratingFilter != null && sorted.length === 0) return <div className="flex items-center justify-center h-40"><p className="text-sm text-muted-foreground">No {type === "city" ? "cities" : "countries"} with this rating</p></div>;

  const isOtherUser = !!userId && userId !== user?.id;
  const sortLabels = getSortLabels(isOtherUser ? profileUsername : undefined);

  const currentLabel = sort === "category-highest"
    ? `${selectedCategory}`
    : sort === "avg-category-highest"
    ? `${avgSelectedCategory}`
    : sortLabels[sort];

  const groupLabel = type === "country" ? "By continent" : "By country";

  // Grouping logic
  const groups: { label: string; items: typeof sorted }[] = [];
  if (grouped) {
    const map = new Map<string, typeof sorted>();
    sorted.forEach((item) => {
      const key = type === "country" ? getContinent(item.name) : item.country;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    if (type === "country") {
      CONTINENT_ORDER.forEach((c) => { if (map.has(c)) groups.push({ label: c, items: map.get(c)! }); });
    } else {
      [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([label, items]) => groups.push({ label, items }));
    }
  }

  // unused sortOrder removed

  const renderGrid = (items: typeof sorted) => (
    <div className="grid grid-cols-3 gap-3">
      {items.map((r, i) => (
        <button key={r.place_id + i} onClick={() => navigate(`/place/${r.place_id}`)} className="relative text-left">
          <div className="aspect-[3/4] w-full relative">
            {isOtherUser && <PosterWishlistButton placeId={r.place_id} placeName={r.name} />}
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
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setGrouped((g) => !g)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
            grouped ? "bg-primary text-primary-foreground" : "text-muted-foreground border border-border hover:text-foreground"
          }`}
        >
          {groupLabel}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground transition-colors">
            {currentLabel}
            <ChevronDown className="w-3.5 h-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            <DropdownMenuItem onClick={() => setSort("your-highest")} className={sort === "your-highest" ? "text-primary font-semibold" : ""}>
              {sortLabels["your-highest"]}
            </DropdownMenuItem>
            <CategorySortDropdown
              label={sortLabels["category-highest"]}
              onSelect={(cat) => { setSelectedCategory(cat); setSort("category-highest"); }}
              selectedCategory={selectedCategory}
              isActive={sort === "category-highest"}
            />
            <DropdownMenuItem onClick={() => setSort("avg-highest")} className={sort === "avg-highest" ? "text-primary font-semibold" : ""}>
              {sortLabels["avg-highest"]}
            </DropdownMenuItem>
            <CategorySortDropdown
              label="Average categories highest first"
              onSelect={(cat) => { setAvgSelectedCategory(cat); setSort("avg-category-highest"); }}
              selectedCategory={avgSelectedCategory}
              isActive={sort === "avg-category-highest"}
            />
            <DropdownMenuItem onClick={() => setSort("newest")} className={sort === "newest" ? "text-primary font-semibold" : ""}>
              {sortLabels["newest"]}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort("longest")} className={sort === "longest" ? "text-primary font-semibold" : ""}>
              {sortLabels["longest"]}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {grouped ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</h3>
              {renderGrid(group.items)}
            </div>
          ))}
        </div>
      ) : (
        renderGrid(sorted)
      )}
    </motion.div>
  );
}
