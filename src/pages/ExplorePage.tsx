import { useState, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DestinationPoster } from "@/components/DestinationPoster";
import { ReviewCard } from "@/components/ReviewCard";
import { reviews } from "@/data/mockData";
import {
  EUROPE_COUNTRIES,
  ASIA_COUNTRIES,
  NORTH_AMERICA_COUNTRIES,
} from "@/lib/continents";

const tabs = ["Places", "Reviews", "Lists"];

type PlaceWithStat = {
  id: string;
  name: string;
  country: string;
  type: string;
  image: string | null;
  stat: number;
};

type SectionConfig = {
  key: string;
  title: string;
  places: PlaceWithStat[];
  linkParams: string;
};

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState("Places");
  const navigate = useNavigate();
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === "Places") fetchPlacesSections();
  }, [activeTab]);

  const fetchPlacesSections = async () => {
    setLoading(true);

    // 1. Trending this month — reviews from this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: monthReviews } = await supabase
      .from("reviews")
      .select("place_id")
      .gte("created_at", startOfMonth);

    const monthCounts = new Map<string, number>();
    (monthReviews || []).forEach((r) => {
      monthCounts.set(r.place_id, (monthCounts.get(r.place_id) || 0) + 1);
    });

    // Fallback to all-time if no reviews this month
    let trendingCounts = monthCounts;
    if (monthCounts.size === 0) {
      const { data: allReviews } = await supabase.from("reviews").select("place_id");
      (allReviews || []).forEach((r) => {
        trendingCounts.set(r.place_id, (trendingCounts.get(r.place_id) || 0) + 1);
      });
    }

    const trendingIds = [...trendingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0]);

    // Fetch all places we'll need
    const { data: allPlaces } = await supabase.from("places").select("*");
    const placesMap = new Map((allPlaces || []).map((p) => [p.id, p]));

    // Fetch all reviews with ratings for top-rated sections
    const { data: allReviewsWithRating } = await supabase
      .from("reviews")
      .select("place_id, rating")
      .not("rating", "is", null);

    const ratingAgg = new Map<string, { total: number; count: number }>();
    (allReviewsWithRating || []).forEach((r) => {
      const cur = ratingAgg.get(r.place_id) || { total: 0, count: 0 };
      cur.total += Number(r.rating);
      cur.count += 1;
      ratingAgg.set(r.place_id, cur);
    });

    // Helper: build trending section
    const buildTrending = (type: string): PlaceWithStat[] => {
      return trendingIds
        .map((id) => placesMap.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p && p.type === type)
        .slice(0, 8)
        .map((p) => ({ ...p, stat: trendingCounts.get(p.id) || 0 }));
    };

    // Helper: build top-rated in continent
    const buildTopRated = (
      type: string,
      continentCountries: string[],
      limit: number
    ): PlaceWithStat[] => {
      const filtered = (allPlaces || []).filter((p) => {
        if (p.type !== type) return false;
        if (type === "country") return continentCountries.includes(p.name);
        return continentCountries.includes(p.country);
      });

      return filtered
        .map((p) => {
          const s = ratingAgg.get(p.id);
          return { ...p, stat: s ? s.total / s.count : 0 };
        })
        .filter((p) => p.stat > 0)
        .sort((a, b) => b.stat - a.stat)
        .slice(0, limit)
        .map((p) => ({ ...p }));
    };

    const result: SectionConfig[] = [
      {
        key: "trending-countries",
        title: "Trendy countries this month",
        places: buildTrending("country"),
        linkParams: "mode=trending&type=country",
      },
      {
        key: "trending-cities",
        title: "Trendy cities this month",
        places: buildTrending("city"),
        linkParams: "mode=trending&type=city",
      },
      {
        key: "top-europe-countries",
        title: "Top 20 countries in Europe",
        places: buildTopRated("country", EUROPE_COUNTRIES, 8),
        linkParams: "mode=top-rated&type=country&continent=Europe&limit=20",
      },
      {
        key: "top-na-cities",
        title: "Top 15 cities in North America",
        places: buildTopRated("city", NORTH_AMERICA_COUNTRIES, 8),
        linkParams: "mode=top-rated&type=city&continent=North America&limit=15",
      },
      {
        key: "top-asia-countries",
        title: "Top 25 countries in Asia",
        places: buildTopRated("country", ASIA_COUNTRIES, 8),
        linkParams: "mode=top-rated&type=country&continent=Asia&limit=25",
      },
    ];

    setSections(result);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        {/* Tabs */}
        <div className="flex items-center gap-6 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative pb-2"
            >
              <span
                className={`text-lg font-semibold transition-colors ${
                  activeTab === tab ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {tab}
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="explore-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {activeTab === "Places" && (
          <>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {sections.map((section) => (
                  <div key={section.key}>
                    <button
                      onClick={() => navigate(`/explore/list?${section.linkParams}`)}
                      className="flex items-center gap-1 mb-3"
                    >
                      <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                      <ChevronRight className="w-5 h-5 text-foreground" />
                    </button>

                    {section.places.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No data yet</p>
                    ) : (
                      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
                        {section.places.map((place) => (
                          <button
                            key={place.id}
                            onClick={() => navigate(`/place/${place.id}`)}
                            className="flex-shrink-0 w-[110px]"
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
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "Reviews" && (
          <div className="space-y-4">
            {reviews.slice(0, 4).map((review) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <ReviewCard review={review} />
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === "Lists" && (
          <p className="text-sm text-muted-foreground text-center py-12">Lists coming soon</p>
        )}
      </div>
    </div>
  );
}
