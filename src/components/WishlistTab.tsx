import { useState, useEffect } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
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

type CountrySort = "recent" | "avg-highest" | "by-continent";
type CitySort = "recent" | "avg-highest" | "by-country";

const COUNTRY_SORT_LABELS: Record<CountrySort, string> = {
  recent: "Recently added",
  "avg-highest": "Average highest first",
  "by-continent": "By continent",
};
const CITY_SORT_LABELS: Record<CitySort, string> = {
  recent: "Recently added",
  "avg-highest": "Average highest first",
  "by-country": "By country",
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
}

export function WishlistTab({ userId, readOnly = false }: { userId?: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"country" | "city">("country");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [countrySort, setCountrySort] = useState<CountrySort>("recent");
  const [citySort, setCitySort] = useState<CitySort>("recent");
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

      // Fetch average ratings
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
    if (subTab === "country") {
      switch (countrySort) {
        case "recent":
          return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        case "avg-highest":
          return [...filtered].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
        case "by-continent": {
          return [...filtered].sort((a, b) => {
            const ca = CONTINENT_ORDER.indexOf(getContinent(a.place.name));
            const cb = CONTINENT_ORDER.indexOf(getContinent(b.place.name));
            if (ca !== cb) return ca - cb;
            return a.place.name.localeCompare(b.place.name);
          });
        }
      }
    } else {
      switch (citySort) {
        case "recent":
          return [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        case "avg-highest":
          return [...filtered].sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
        case "by-country":
          return [...filtered].sort((a, b) => {
            const cmp = a.place.country.localeCompare(b.place.country);
            if (cmp !== 0) return cmp;
            return a.place.name.localeCompare(b.place.name);
          });
      }
    }
    return filtered;
  };

  const sorted = getSorted();
  const currentSortLabel = subTab === "country" ? COUNTRY_SORT_LABELS[countrySort] : CITY_SORT_LABELS[citySort];

  // Group items for "by-continent" or "by-country" display
  const isGrouped = (subTab === "country" && countrySort === "by-continent") || (subTab === "city" && citySort === "by-country");
  const groups: { label: string; items: WishlistItem[] }[] = [];
  if (isGrouped) {
    const map = new Map<string, WishlistItem[]>();
    sorted.forEach((item) => {
      const key = subTab === "country" ? getContinent(item.place.name) : item.place.country;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });
    map.forEach((items, label) => groups.push({ label, items }));
  }

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["country", "city"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${
                subTab === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {t === "country" ? "Countries" : "Cities"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground transition-colors">
              {currentSortLabel}
              <ChevronDown className="w-3.5 h-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[200px]">
              {subTab === "country"
                ? (Object.keys(COUNTRY_SORT_LABELS) as CountrySort[]).map((key) => (
                    <DropdownMenuItem key={key} onClick={() => setCountrySort(key)} className={countrySort === key ? "text-primary font-semibold" : ""}>
                      {COUNTRY_SORT_LABELS[key]}
                    </DropdownMenuItem>
                  ))
                : (Object.keys(CITY_SORT_LABELS) as CitySort[]).map((key) => (
                    <DropdownMenuItem key={key} onClick={() => setCitySort(key)} className={citySort === key ? "text-primary font-semibold" : ""}>
                      {CITY_SORT_LABELS[key]}
                    </DropdownMenuItem>
                  ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {!readOnly && (
            <button onClick={() => setPickerOpen(true)} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">No {subTab === "country" ? "countries" : "cities"} in wishlist</p>
        </div>
      ) : isGrouped ? (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.label}</h3>
              <div className="grid grid-cols-3 gap-3">
                {group.items.map((item) => (
                  <div key={item.id} className="relative aspect-[3/4]">
                    <DestinationPoster placeId={item.place.id} name={item.place.name} country={item.place.country} type={item.place.type as "city" | "country"} image={item.place.image} className="w-full h-full" />
                    {!readOnly && (
                      <button onClick={() => handleRemove(item.id)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                        <X className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {sorted.map((item) => (
            <div key={item.id} className="relative aspect-[3/4]">
              <DestinationPoster placeId={item.place.id} name={item.place.name} country={item.place.country} type={item.place.type as "city" | "country"} image={item.place.image} className="w-full h-full" />
              {!readOnly && (
                <button onClick={() => handleRemove(item.id)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
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
