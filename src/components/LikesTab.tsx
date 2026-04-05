import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { dedupeByNewest } from "@/lib/reviewDedup";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { PosterWishlistButton } from "@/components/PosterWishlistButton";
import { StarRating } from "@/components/StarRating";
import { ReviewCard } from "@/components/ReviewCard";
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

type DestSort = "your-highest" | "category-highest" | "avg-highest" | "avg-category-highest" | "newest" | "longest";

const getSortLabels = (name?: string): Record<DestSort, string> => ({
  "your-highest": name ? `${name}'s highest first` : "Your highest first",
  "category-highest": name ? `${name}'s categories highest first` : "Your categories highest first",
  "avg-highest": "Average highest first",
  "avg-category-highest": "Average categories highest first",
  "newest": name ? `${name}'s newest visited first` : "Newest visited first",
  "longest": name ? `${name}'s highest total duration first` : "Highest total duration first",
});

interface LikedEntry {
  id: string;
  rating: number;
  place: { id: string; name: string; country: string; type: string; image: string | null };
  visit_year?: number | null;
  visit_month?: number | null;
  duration_days?: number | null;
  avg_rating?: number;
  _catRating?: number;
  _avgCatRating?: number;
}

type Section = "countries" | "cities" | "reviews" | "lists";

export function LikesTab({ userId, profileUsername }: { userId?: string; profileUsername?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>("countries");
  const [countries, setCountries] = useState<LikedEntry[]>([]);
  const [cities, setCities] = useState<LikedEntry[]>([]);
  const [likedReviews, setLikedReviews] = useState<any[]>([]);
  const [likedLists, setLikedLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [destSort, setDestSort] = useState<DestSort>("your-highest");
  const [selectedCategory, setSelectedCategory] = useState<SubRatingCategory>("Natural Beauty");
  const [avgSelectedCategory, setAvgSelectedCategory] = useState<SubRatingCategory>("Natural Beauty");
  const [grouped, setGrouped] = useState(false);
  const targetUserId = userId || user?.id;
  const isOtherUser = !!userId && userId !== user?.id;

  useEffect(() => {
    if (!targetUserId) return;
    fetchAll();
  }, [targetUserId]);

  const fetchAll = async () => {
    if (!targetUserId) return;
    setLoading(true);

    // Liked destinations (countries & cities) - include visit info
    const { data: destData } = await supabase
      .from("reviews")
      .select("id, rating, visit_year, visit_month, duration_days, created_at, places!inner(id, name, country, type, image)")
      .eq("user_id", targetUserId)
      .eq("liked", true)
      .order("created_at", { ascending: false });

    if (destData) {
      const allMapped = destData.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        visit_year: r.visit_year,
        visit_month: r.visit_month,
        duration_days: r.duration_days,
        created_at: r.created_at,
        place: { id: r.places.id, name: r.places.name, country: r.places.country, type: r.places.type, image: r.places.image },
      }));
      // Deduplicate per place - keep newest visit date
      const mapped: LikedEntry[] = dedupeByNewest(allMapped, (m) => m.place.id);

      // Fetch avg ratings
      const placeIds = [...new Set(mapped.map((m) => m.place.id))];
      if (placeIds.length > 0) {
        const { data: allReviews } = await supabase.from("reviews").select("place_id, rating").in("place_id", placeIds);
        if (allReviews) {
          const avgMap: Record<string, { sum: number; count: number }> = {};
          allReviews.forEach((r: any) => {
            if (r.rating == null) return;
            if (!avgMap[r.place_id]) avgMap[r.place_id] = { sum: 0, count: 0 };
            avgMap[r.place_id].sum += Number(r.rating);
            avgMap[r.place_id].count++;
          });
          mapped.forEach((m) => {
            const a = avgMap[m.place.id];
            m.avg_rating = a ? a.sum / a.count : undefined;
          });
        }
      }

      setCountries(mapped.filter((m) => m.place.type === "country"));
      setCities(mapped.filter((m) => m.place.type === "city"));
    }

    // Liked reviews
    const { data: reviewLikes } = await supabase
      .from("review_likes")
      .select("id, review_id")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (reviewLikes && reviewLikes.length > 0) {
      const reviewIds = reviewLikes.map((rl) => rl.review_id);
      const { data: reviews } = await supabase
        .from("reviews")
        .select("*, places!inner(name, image)")
        .in("id", reviewIds);

      if (reviews && reviews.length > 0) {
        const userIds = [...new Set(reviews.map((r) => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

        setLikedReviews(
          reviewIds
            .map((rid) => {
              const r = reviews.find((rv: any) => rv.id === rid);
              if (!r) return null;
              const prof = profileMap.get(r.user_id);
              return {
                ...r,
                profile_username: prof?.username,
                profile_picture: prof?.profile_picture,
                place_name: (r as any).places?.name,
                place_image: (r as any).places?.image,
              };
            })
            .filter(Boolean)
        );
      }
    }

    // Liked lists
    const { data: listLikes } = await supabase
      .from("list_likes")
      .select("id, list_id")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (listLikes && listLikes.length > 0) {
      const listIds = listLikes.map((ll) => ll.list_id);
      const { data: lists } = await supabase.from("lists").select("*").in("id", listIds);

      if (lists && lists.length > 0) {
        const userIds = [...new Set(lists.map((l) => l.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, profile_picture")
          .in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

        const enriched = await Promise.all(
          listIds.map(async (lid) => {
            const l = lists.find((ls: any) => ls.id === lid);
            if (!l) return null;
            const { count } = await supabase
              .from("list_items")
              .select("*", { count: "exact", head: true })
              .eq("list_id", l.id);
            const prof = profileMap.get(l.user_id);
            return { ...l, item_count: count || 0, username: prof?.username, profile_picture: prof?.profile_picture };
          })
        );
        setLikedLists(enriched.filter(Boolean));
      }
    }

    setLoading(false);
  };

  // Fetch user category ratings for liked destinations
  const currentDestItems = activeSection === "countries" ? countries : cities;
  const setCurrentDestItems = activeSection === "countries" ? setCountries : setCities;

  useEffect(() => {
    if (destSort !== "category-highest" || currentDestItems.length === 0 || !targetUserId) return;
    (async () => {
      const placeIds = currentDestItems.map((p) => p.place.id);
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
      setCurrentDestItems((prev) => prev.map((p) => ({ ...p, _catRating: catMap[p.place.id] ?? 0 })));
    })();
  }, [destSort, selectedCategory, currentDestItems.length, targetUserId, activeSection]);

  // Fetch average category ratings for liked destinations (all users)
  useEffect(() => {
    if (destSort !== "avg-category-highest" || currentDestItems.length === 0) return;
    (async () => {
      const placeIds = currentDestItems.map((p) => p.place.id);
      const { data: allReviews } = await supabase.from("reviews").select("id, place_id").in("place_id", placeIds);
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
      setCurrentDestItems((prev) => prev.map((p) => {
        const a = catMap[p.place.id];
        return { ...p, _avgCatRating: a ? a.sum / a.count : 0 };
      }));
    })();
  }, [destSort, avgSelectedCategory, currentDestItems.length, activeSection]);

  const sortDest = (items: LikedEntry[]) => {
    return [...items].sort((a, b) => {
      switch (destSort) {
        case "your-highest":
          return (b.rating ?? 0) - (a.rating ?? 0);
        case "avg-highest":
          return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
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
  };

  const sections: { key: Section; label: string; count: number }[] = [
    { key: "countries", label: "Countries", count: countries.length },
    { key: "cities", label: "Cities", count: cities.length },
    { key: "reviews", label: "Reviews", count: likedReviews.length },
    { key: "lists", label: "Lists", count: likedLists.length },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const sortLabels = getSortLabels(isOtherUser ? profileUsername : undefined);
  // dropdown order handled inline below
  const currentLabel = destSort === "category-highest"
    ? `${selectedCategory}`
    : destSort === "avg-category-highest"
    ? `${avgSelectedCategory}`
    : sortLabels[destSort];

  const isDestSection = activeSection === "countries" || activeSection === "cities";
  const groupLabel = activeSection === "countries" ? "By continent" : "By country";

  const renderDestGrid = (items: LikedEntry[]) => (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <button key={item.id} onClick={() => navigate(`/place/${item.place.id}`)} className="relative text-left">
          <div className="aspect-[3/4] w-full relative">
            {isOtherUser && <PosterWishlistButton placeId={item.place.id} placeName={item.place.name} />}
            <DestinationPoster placeId={item.place.id} name={item.place.name} country={item.place.country} type={item.place.type as "city" | "country"} image={item.place.image} className="w-full h-full" />
          </div>
          <div className="mt-1.5 flex justify-center">
            <StarRating rating={item.rating} size={12} liked />
          </div>
        </button>
      ))}
    </div>
  );

  const renderDestSection = (items: LikedEntry[], emptyLabel: string) => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-8">{emptyLabel}</p>;
    }

    const sortedItems = sortDest(items);

    // Grouping
    const groups: { label: string; items: LikedEntry[] }[] = [];
    if (grouped) {
      const map = new Map<string, LikedEntry[]>();
      sortedItems.forEach((item) => {
        const key = activeSection === "countries" ? getContinent(item.place.name) : item.place.country;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      });
      if (activeSection === "countries") {
        CONTINENT_ORDER.forEach((c) => { if (map.has(c)) groups.push({ label: c, items: map.get(c)! }); });
      } else {
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([label, items]) => groups.push({ label, items }));
      }
    }

    return (
      <>
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
              <DropdownMenuItem onClick={() => setDestSort("your-highest")} className={destSort === "your-highest" ? "text-primary font-semibold" : ""}>
                {sortLabels["your-highest"]}
              </DropdownMenuItem>
              <CategorySortDropdown
                label={sortLabels["category-highest"]}
                onSelect={(cat) => { setSelectedCategory(cat); setDestSort("category-highest"); }}
                selectedCategory={selectedCategory}
                isActive={destSort === "category-highest"}
              />
              <DropdownMenuItem onClick={() => setDestSort("avg-highest")} className={destSort === "avg-highest" ? "text-primary font-semibold" : ""}>
                {sortLabels["avg-highest"]}
              </DropdownMenuItem>
              <CategorySortDropdown
                label="Average categories highest first"
                onSelect={(cat) => { setAvgSelectedCategory(cat); setDestSort("avg-category-highest"); }}
                selectedCategory={avgSelectedCategory}
                isActive={destSort === "avg-category-highest"}
              />
              <DropdownMenuItem onClick={() => setDestSort("newest")} className={destSort === "newest" ? "text-primary font-semibold" : ""}>
                {sortLabels["newest"]}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDestSort("longest")} className={destSort === "longest" ? "text-primary font-semibold" : ""}>
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
                {renderDestGrid(group.items)}
              </div>
            ))}
          </div>
        ) : (
          renderDestGrid(sortedItems)
        )}
      </>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeSection === s.key
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {s.label} {s.count > 0 && `(${s.count})`}
          </button>
        ))}
      </div>

      {activeSection === "countries" && renderDestSection(countries, "No liked countries yet")}
      {activeSection === "cities" && renderDestSection(cities, "No liked cities yet")}

      {activeSection === "reviews" && (
        likedReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No liked reviews yet</p>
        ) : (
          <div className="space-y-3">
            {likedReviews.map((r: any) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        )
      )}

      {activeSection === "lists" && (
        likedLists.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No liked lists yet</p>
        ) : (
          <div className="space-y-3">
            {likedLists.map((l: any) => (
              <motion.div key={l.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-4 border border-border">
                <button onClick={() => navigate(`/profile/${l.user_id}`)} className="w-full text-left">
                  <div className="flex items-center gap-2 mb-1">
                    {l.profile_picture && (
                      <img src={l.profile_picture} alt="" className="w-6 h-6 rounded-full object-cover" />
                    )}
                    <span className="text-xs text-muted-foreground">{l.username || "User"}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{l.item_count} destination{l.item_count !== 1 ? "s" : ""}</p>
                </button>
              </motion.div>
            ))}
          </div>
        )
      )}
    </motion.div>
  );
}
