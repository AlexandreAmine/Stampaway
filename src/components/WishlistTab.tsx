import { useState, useEffect } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { PosterWishlistButton } from "@/components/PosterWishlistButton";
import { FavoritePicker } from "@/components/FavoritePicker";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EUROPE_COUNTRIES, ASIA_COUNTRIES, NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA_COUNTRIES, AFRICA_COUNTRIES, OCEANIA_COUNTRIES,
} from "@/lib/continents";
import { CategorySortDropdown, type SubRatingCategory } from "@/components/CategorySortDropdown";

type WishSort = "recent" | "avg-highest" | "category-avg";

const SORT_LABELS: Record<WishSort, string> = {
  recent: "Recently added",
  "avg-highest": "Average highest first",
  "category-avg": "Categories average highest first",
};

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

interface WishlistItem {
  id: string;
  created_at: string;
  place: { id: string; name: string; country: string; type: string; image: string | null };
  avg_rating?: number;
  _catAvg?: number;
}

export function WishlistTab({ userId, readOnly = false }: { userId?: string; readOnly?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"country" | "city">("country");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sort, setSort] = useState<WishSort>("recent");
  const [selectedCategory, setSelectedCategory] = useState<SubRatingCategory>("Natural Beauty");
  const [grouped, setGrouped] = useState(false);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) fetchWishlist();
  }, [targetUserId]);

  const fetchWishlist = async () => {
    if (!targetUserId) return;
    const { data } = await supabase
      .from("wishlists")
      .select("id, created_at, places!inner(id, name, country, type, image)")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped: WishlistItem[] = data.map((w: any) => ({
        id: w.id,
        created_at: w.created_at,
        place: { id: w.places.id, name: w.places.name, country: w.places.country, type: w.places.type, image: w.places.image },
      }));

      const placeIds = [...new Set(mapped.map((m) => m.place.id))];
      if (placeIds.length > 0) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("place_id, rating")
          .in("place_id", placeIds);
        if (reviews) {
          const avgMap: Record<string, { sum: number; count: number }> = {};
          reviews.forEach((r: any) => {
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

      setItems(mapped);
    }
    setLoading(false);
  };

  // Fetch category avg when sort is category-avg
  useEffect(() => {
    if (sort !== "category-avg" || items.length === 0) return;
    const filtered = items.filter((i) => i.place.type === subTab);
    const placeIds = filtered.map((i) => i.place.id);
    if (placeIds.length === 0) return;

    (async () => {
      const { data: reviews } = await supabase.from("reviews").select("id, place_id").in("place_id", placeIds);
      if (!reviews || reviews.length === 0) return;
      const reviewIds = reviews.map((r) => r.id);
      const reviewPlaceMap = new Map(reviews.map((r) => [r.id, r.place_id]));

      const { data: subRatings } = await supabase
        .from("review_sub_ratings")
        .select("review_id, category, rating")
        .in("review_id", reviewIds)
        .eq("category", selectedCategory);

      const catMap: Record<string, { sum: number; count: number }> = {};
      (subRatings || []).forEach((sr: any) => {
        const pid = reviewPlaceMap.get(sr.review_id);
        if (!pid) return;
        if (!catMap[pid]) catMap[pid] = { sum: 0, count: 0 };
        catMap[pid].sum += Number(sr.rating);
        catMap[pid].count++;
      });
      setItems((prev) => prev.map((item) => {
        const a = catMap[item.place.id];
        return { ...item, _catAvg: a ? a.sum / a.count : 0 };
      }));
    })();
  }, [sort, selectedCategory, items.length, subTab]);

  const handleAdd = async (placeId: string) => {
    if (!user) return;
    const exists = items.some((i) => i.place.id === placeId);
    if (exists) { toast("Already in wishlist"); return; }
    const { error } = await supabase.from("wishlists").insert({ user_id: user.id, place_id: placeId });
    if (error) { toast.error("Failed to add"); return; }
    toast.success("Added to wishlist!");
    fetchWishlist();
  };

  const handleRemove = async (wishlistId: string) => {
    await supabase.from("wishlists").delete().eq("id", wishlistId);
    toast.success("Removed from wishlist");
    fetchWishlist();
  };

  const filtered = items.filter((i) => i.place.type === subTab);

  const getSorted = () => {
    switch (sort) {
      case "recent":
        return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "avg-highest":
        return [...filtered].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
      case "category-avg":
        return [...filtered].sort((a, b) => (b._catAvg ?? 0) - (a._catAvg ?? 0));
    }
    return filtered;
  };

  const sorted = getSorted();

  const currentLabel = sort === "category-avg"
    ? `${selectedCategory}`
    : SORT_LABELS[sort];

  const groupLabel = subTab === "country" ? "By continent" : "By country";

  // Grouping
  const groups: { label: string; items: WishlistItem[] }[] = [];
  if (grouped) {
    const map = new Map<string, WishlistItem[]>();
    sorted.forEach((item) => {
      const key = subTab === "country" ? getContinent(item.place.name) : item.place.country;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    if (subTab === "country") {
      CONTINENT_ORDER.forEach((c) => { if (map.has(c)) groups.push({ label: c, items: map.get(c)! }); });
    } else {
      [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([label, items]) => groups.push({ label, items }));
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 pt-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="aspect-[3/4] bg-muted/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const renderGrid = (gridItems: WishlistItem[]) => (
    <div className="grid grid-cols-3 gap-3">
      {gridItems.map((item) => (
        <div key={item.id} className="relative aspect-[3/4] cursor-pointer" onClick={() => navigate(`/place/${item.place.id}`)}>
          {readOnly && <PosterWishlistButton placeId={item.place.id} placeName={item.place.name} />}
          <DestinationPoster placeId={item.place.id} name={item.place.name} country={item.place.country} type={item.place.type as "city" | "country"} image={item.place.image} className="w-full h-full" />
          {!readOnly && (
            <button onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
              <X className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["country", "city"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setSubTab(t); setGrouped(false); }}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${
                subTab === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {t === "country" ? "Countries" : "Cities"}
            </button>
          ))}
        </div>
        {!readOnly && (
          <button onClick={() => setPickerOpen(true)} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Plus className="w-4 h-4 text-primary" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">No {subTab === "country" ? "countries" : "cities"} in wishlist</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
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
                {(["recent", "avg-highest"] as WishSort[]).map((key) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => setSort(key)}
                    className={sort === key ? "text-primary font-semibold" : ""}
                  >
                    {SORT_LABELS[key]}
                  </DropdownMenuItem>
                ))}
                <CategorySortDropdown
                  label="Categories average highest first"
                  onSelect={(cat) => { setSelectedCategory(cat); setSort("category-avg"); }}
                  selectedCategory={selectedCategory}
                  isActive={sort === "category-avg"}
                />
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
        </>
      )}

      <FavoritePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        type={subTab}
        onSelect={(placeId) => { handleAdd(placeId); setPickerOpen(false); }}
      />
    </motion.div>
  );
}
