import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { DestinationPoster } from "@/components/DestinationPoster";
import {
  fetchMonthlyVisitorCountMap,
  fetchAllTimeVisitorCountMap,
  fetchAverageRatingMap,
  fetchAllPlaces,
  fetchCategoryAverageMap,
} from "@/lib/placeRankings";
import {
  EUROPE_COUNTRIES,
  ASIA_COUNTRIES,
  NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA_COUNTRIES,
  NAMED_REGIONS,
  EASTERN_EUROPE_COUNTRIES,
} from "@/lib/continents";

type PlaceWithStat = {
  id: string;
  name: string;
  country: string;
  type: string;
  image: string | null;
  stat: number;
};

const CATEGORY_TITLE: Record<string, { country: string; city: string }> = {
  "Affordability": { country: "most affordable countries", city: "most affordable cities" },
  "Entertainment & Nightlife": { country: "most vibrant countries", city: "most vibrant cities" },
  "Natural Beauty": { country: "most scenic countries", city: "most scenic cities" },
  "Safety & Security": { country: "safest countries", city: "safest cities" },
  "Hospitality & People": { country: "most welcoming countries", city: "most welcoming cities" },
};

export default function ExploreListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get("mode") || "trending";
  const placeType = searchParams.get("type") || "country";
  const continent = searchParams.get("continent") || "";
  const category = searchParams.get("category") || "";
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const [places, setPlaces] = useState<PlaceWithStat[]>([]);
  const [loading, setLoading] = useState(true);

  const getTitle = () => {
    if (mode === "trending") {
      return `Trendy ${placeType === "country" ? "countries" : "cities"} this month`;
    }
    if (mode === "by-category" && category && CATEGORY_TITLE[category]) {
      const label = placeType === "country" ? CATEGORY_TITLE[category].country : CATEGORY_TITLE[category].city;
      return `${limit} ${label}`;
    }
    const regionLabel = continent || "World";
    return `Top ${limit} ${placeType === "country" ? "countries" : "cities"} in ${regionLabel}`;
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, placeType, continent, limit, category]);

  const getContinentCountries = (c: string): string[] | null => {
    switch (c.toLowerCase()) {
      case "europe": return EUROPE_COUNTRIES;
      case "asia": return ASIA_COUNTRIES;
      case "north america": return NORTH_AMERICA_COUNTRIES;
      case "south america": return SOUTH_AMERICA_COUNTRIES;
      default: return null;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const allPlaces = await fetchAllPlaces();

    if (mode === "trending") {
      let countMap = await fetchMonthlyVisitorCountMap();
      if (countMap.size === 0) {
        countMap = await fetchAllTimeVisitorCountMap();
      }

      const filtered = allPlaces
        .filter((p) => p.type === placeType && countMap.has(p.id))
        .map((p) => ({ ...p, stat: countMap.get(p.id) || 0 }))
        .sort((a, b) => b.stat - a.stat || a.name.localeCompare(b.name));

      setPlaces(filtered);
    } else if (mode === "by-category" && category) {
      const catMap = await fetchCategoryAverageMap(category);
      const filtered = allPlaces
        .filter((p) => p.type === placeType && catMap.has(p.id))
        .map((p) => ({ ...p, stat: catMap.get(p.id) || 0 }))
        .sort((a, b) => {
          if (b.stat !== a.stat) return b.stat - a.stat;
          return a.name.localeCompare(b.name);
        })
        .slice(0, limit);
      setPlaces(filtered);
    } else {
      // Top rated — use all-time average ratings
      const avgMap = await fetchAverageRatingMap();
      const continentCountries = getContinentCountries(continent);

      const filtered = allPlaces
        .filter((p) => {
          if (p.type !== placeType) return false;
          if (!continentCountries) return true;
          return placeType === "country"
            ? continentCountries.includes(p.name)
            : continentCountries.includes(p.country);
        })
        .map((p) => ({ ...p, stat: avgMap.get(p.id) || 0 }))
        .sort((a, b) => {
          if (b.stat !== a.stat) return b.stat - a.stat;
          return a.name.localeCompare(b.name);
        })
        .slice(0, limit);

      setPlaces(filtered);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{getTitle()}</h1>
        </div>

        {loading ? (
          <div className="grid grid-cols-3 gap-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : places.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No destinations found</p>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-2.5">
            {places.map((place) => (
              <button
                key={place.id}
                onClick={() => navigate(`/place/${place.id}`)}
                className="relative text-left"
              >
                <div className="aspect-[3/4] w-full">
                  <DestinationPoster
                    placeId={place.id}
                    name={place.name}
                    country={place.country}
                    type={place.type as "city" | "country"}
                    image={place.image}
                    autoGenerate
                    className="w-full h-full"
                  />
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
