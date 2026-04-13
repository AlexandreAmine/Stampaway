import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { DestinationPoster } from "@/components/DestinationPoster";
import {
  EUROPE_COUNTRIES,
  ASIA_COUNTRIES,
  NORTH_AMERICA_COUNTRIES,
  SOUTH_AMERICA_COUNTRIES,
} from "@/lib/continents";

type PlaceWithStat = {
  id: string;
  name: string;
  country: string;
  type: string;
  image: string | null;
  stat: number;
};

export default function ExploreListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get("mode") || "trending"; // trending | top-rated
  const placeType = searchParams.get("type") || "country"; // country | city
  const continent = searchParams.get("continent") || "";
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const [places, setPlaces] = useState<PlaceWithStat[]>([]);
  const [loading, setLoading] = useState(true);

  const getTitle = () => {
    if (mode === "trending") {
      return `Trendy ${placeType === "country" ? "countries" : "cities"} this month`;
    }
    const regionLabel = continent || "World";
    return `Top ${limit} ${placeType === "country" ? "countries" : "cities"} in ${regionLabel}`;
  };

  useEffect(() => {
    fetchData();
  }, [mode, placeType, continent, limit]);

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

    if (mode === "trending") {
      // Reviews from this month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: monthReviews } = await supabase
        .from("reviews")
        .select("place_id")
        .gte("created_at", startOfMonth);

      const counts = new Map<string, number>();
      (monthReviews || []).forEach((r) => {
        counts.set(r.place_id, (counts.get(r.place_id) || 0) + 1);
      });

      if (counts.size === 0) {
        // Fallback: all-time
        const { data: allReviews } = await supabase.from("reviews").select("place_id");
        (allReviews || []).forEach((r) => {
          counts.set(r.place_id, (counts.get(r.place_id) || 0) + 1);
        });
      }

      const topIds = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map((e) => e[0]);

      if (topIds.length === 0) { setPlaces([]); setLoading(false); return; }

      const { data: placesData } = await supabase
        .from("places")
        .select("*")
        .eq("type", placeType)
        .in("id", topIds);

      const sorted = (placesData || [])
        .map((p) => ({ ...p, stat: counts.get(p.id) || 0 }))
        .sort((a, b) => b.stat - a.stat);

      setPlaces(sorted);
    } else {
      // Top rated in continent
      const continentCountries = getContinentCountries(continent);

      let query = supabase.from("places").select("*").eq("type", placeType);

      if (placeType === "country" && continentCountries) {
        query = query.in("name", continentCountries);
      } else if (placeType === "city" && continentCountries) {
        query = query.in("country", continentCountries);
      }

      const { data: placesData } = await query;
      if (!placesData || placesData.length === 0) { setPlaces([]); setLoading(false); return; }

      const ids = placesData.map((p) => p.id);
      const { data: reviews } = await supabase
        .from("reviews")
        .select("place_id, rating")
        .in("place_id", ids)
        .not("rating", "is", null);

      const sums = new Map<string, { total: number; count: number }>();
      (reviews || []).forEach((r) => {
        const cur = sums.get(r.place_id) || { total: 0, count: 0 };
        cur.total += Number(r.rating);
        cur.count += 1;
        sums.set(r.place_id, cur);
      });

      const withAvg = placesData
        .map((p) => {
          const s = sums.get(p.id);
          return { ...p, stat: s ? s.total / s.count : 0 };
        })
        .sort((a, b) => {
          if (b.stat !== a.stat) return b.stat - a.stat;
          return a.name.localeCompare(b.name);
        })
        .slice(0, limit);

      setPlaces(withAvg);
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
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
