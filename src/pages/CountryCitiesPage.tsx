import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronDown } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { PosterWishlistButton } from "@/components/PosterWishlistButton";
import { useLocalizedPlaceName } from "@/hooks/useLocalizedPlaceName";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategorySortDropdown, type SubRatingCategory } from "@/components/CategorySortDropdown";
import {
  fetchAllTimeVisitorCountMap,
  fetchAverageRatingMap,
  fetchCategoryAverageMap,
} from "@/lib/placeRankings";

type DestSort = "most-popular" | "avg-highest" | "category-avg";

export default function CountryCitiesPage() {
  const { countryName } = useParams<{ countryName: string }>();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "all";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [cities, setCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [destSort, setDestSort] = useState<DestSort>("most-popular");
  const [selectedCategory, setSelectedCategory] = useState<SubRatingCategory>("Natural Beauty");
  const [visibleCount, setVisibleCount] = useState(500);

  useEffect(() => {
    if (countryName) fetchCities();
  }, [countryName, mode]);

  useEffect(() => {
    setVisibleCount(500);
  }, [destSort, selectedCategory]);

  const fetchCities = async () => {
    if (!countryName) return;
    setLoading(true);
    const decoded = decodeURIComponent(countryName);

    let baseCities: any[] = [];

    if (mode === "wishlist" && user) {
      const { data: wishlistData } = await supabase
        .from("wishlists")
        .select("place_id, places!inner(id, name, country, type, image)")
        .eq("user_id", user.id);

      baseCities = (wishlistData || [])
        .filter((w: any) => w.places.type === "city" && w.places.country === decoded)
        .map((w: any) => ({ ...w.places }));
    } else {
      const { data: placesData } = await supabase
        .from("places")
        .select("id, name, country, type, image")
        .eq("type", "city")
        .eq("country", decoded);
      baseCities = placesData || [];
    }

    if (baseCities.length === 0) {
      setCities([]);
      setLoading(false);
      return;
    }

    // Attach review_count using the centralized visitor count map
    const countMap = await fetchAllTimeVisitorCountMap();
    const withCounts = baseCities.map((c) => ({
      ...c,
      review_count: countMap.get(c.id) || 0,
    }));

    setCities(withCounts);
    setLoading(false);
  };

  // Fetch additional metrics when sort changes
  useEffect(() => {
    if (cities.length === 0) return;
    if (destSort === "most-popular") return;

    (async () => {
      const placeIds = cities.map((c) => c.id);
      if (destSort === "avg-highest") {
        const avgMap = await fetchAverageRatingMap();
        setCities((prev) => prev.map((c) => ({ ...c, _avg: avgMap.get(c.id) || 0 })));
      } else if (destSort === "category-avg") {
        const catMap = await fetchCategoryAverageMap(selectedCategory, placeIds);
        setCities((prev) => prev.map((c) => ({ ...c, _catAvg: catMap.get(c.id) || 0 })));
      }
    })();
  }, [destSort, selectedCategory, cities.length]);

  const sortedCities = useMemo(() => {
    if (destSort === "most-popular") {
      return [...cities].sort((a, b) => {
        const diff = (b.review_count || 0) - (a.review_count || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
    }
    if (destSort === "avg-highest") {
      return [...cities].sort((a, b) => (b._avg ?? 0) - (a._avg ?? 0));
    }
    if (destSort === "category-avg") {
      return [...cities].sort((a, b) => (b._catAvg ?? 0) - (a._catAvg ?? 0));
    }
    return cities;
  }, [cities, destSort, selectedCategory]);

  const decoded = countryName ? decodeURIComponent(countryName) : "";
  const localizedDecoded = useLocalizedPlaceName(decoded, true);
  const title = mode === "wishlist" ? `${t("wishlist.title")} · ${localizedDecoded}` : t("place.citiesIn", { country: localizedDecoded });

  const currentLabel =
    destSort === "category-avg"
      ? `${selectedCategory}`
      : destSort === "most-popular"
      ? t("search.mostPopular")
      : t("search.avgHighest");

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
        </div>

        {!loading && cities.length > 0 && (
          <div className="flex items-center justify-end mb-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-xs text-muted-foreground border border-border rounded-lg px-3 py-1.5 hover:text-foreground transition-colors">
                {currentLabel}
                <ChevronDown className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuItem
                  onClick={() => setDestSort("most-popular")}
                  className={destSort === "most-popular" ? "text-primary font-semibold" : ""}
                >
                  {t("search.mostPopular")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDestSort("avg-highest")}
                  className={destSort === "avg-highest" ? "text-primary font-semibold" : ""}
                >
                  {t("search.avgHighest")}
                </DropdownMenuItem>
                <CategorySortDropdown
                  label={t("search.catAvgHighest")}
                  onSelect={(cat) => {
                    setSelectedCategory(cat);
                    setDestSort("category-avg");
                  }}
                  selectedCategory={selectedCategory}
                  isActive={destSort === "category-avg"}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sortedCities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {mode === "wishlist" ? "No cities from this country in your wishlist" : "No cities found"}
          </p>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-3 gap-2.5"
            >
              {sortedCities.slice(0, visibleCount).map((city) => (
                <button
                  key={city.id}
                  onClick={() => navigate(`/place/${city.id}`)}
                  className="relative text-left aspect-[3/4] w-full"
                >
                  <PosterWishlistButton placeId={city.id} placeName={city.name} />
                  <DestinationPoster
                    placeId={city.id}
                    name={city.name}
                    country={city.country}
                    type="city"
                    image={city.image}
                    autoGenerate
                    className="w-full h-full"
                  />
                </button>
              ))}
            </motion.div>
            {sortedCities.length > visibleCount && (
              <div className="flex justify-center mt-5">
                <button
                  onClick={() => setVisibleCount((c) => c + 500)}
                  className="text-xs font-medium px-4 py-2 rounded-lg bg-card border border-border text-foreground hover:bg-accent transition-colors"
                >
                  View more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
