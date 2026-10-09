import { useState, useEffect } from "react";
import { createPersistentCache } from "@/lib/persistentCache";
import { fetchPlaceRanks } from "@/lib/placeRankings";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Utensils, Trophy, Star, Sun, TrendingUp, TrendingDown, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface CityFactsProps {
  cityName: string;
  countryName: string;
  placeId: string;
}

interface CityFactsData {
  population: string;
  area_km2: string;
  fun_facts: string[];
  famous_dish: string;
  city_records: string[];
  avg_weather_by_month: { month: string; avg_temp_c: number }[];
  most_touristic_months: string[];
  least_touristic_months: string[];
}

// Key facts change rarely: keep the last ~60 cities opened, for a week.
const cityFactsCache = createPersistentCache<CityFactsData>("city_facts", { maxEntries: 60, ttlMs: 7 * 24 * 60 * 60 * 1000 });

export function CityFacts({ cityName, countryName, placeId }: CityFactsProps) {
  const { t, language } = useLanguage();
  const [facts, setFacts] = useState<CityFactsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitorRank, setVisitorRank] = useState<number | null>(null);
  const [ratingRank, setRatingRank] = useState<number | null>(null);

  useEffect(() => {
    fetchFacts();
    fetchRankings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityName, countryName, language]);

  const fetchFacts = async () => {
    // Shown at once from the phone when this city was opened before.
    const cacheKey = `${cityName}|${countryName}|${language}`;
    const saved = cityFactsCache.get(cacheKey);
    if (saved) {
      setFacts(saved);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: cached } = await supabase
        .from("city_facts")
        .select("facts")
        .eq("city_name", cityName)
        .eq("country_name", countryName)
        .eq("language", language)
        .maybeSingle() as any;

      if (cached?.facts) {
        setFacts(cached.facts as CityFactsData);
        cityFactsCache.set(cacheKey, cached.facts as CityFactsData);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("get-city-facts", {
        body: { city_name: cityName, country_name: countryName, language },
      });

      if (data && !error) {
        setFacts(data as CityFactsData);
        cityFactsCache.set(cacheKey, data as CityFactsData);
      }
    } catch (e) {
      console.error("Failed to load city facts:", e);
    }
    setLoading(false);
  };

  const fetchRankings = async () => {
    try {
      const ranks = await fetchPlaceRanks(placeId, "city");
      setVisitorRank(ranks.visitorRank);
      setRatingRank(ranks.ratingRank);
    } catch {
      // Rankings are a bonus line; the facts still show without them.
    }
  };

  if (loading) {
    return (
      <div className="mt-8 space-y-3">
        <h3 className="section-title">{t("facts.keyFacts")}</h3>
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-card rounded-lg skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!facts) return null;

  const maxTemp = Math.max(...(facts.avg_weather_by_month || []).map((m) => m.avg_temp_c));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 border-t border-border pt-6">
      <h3 className="section-title mb-5">{t("facts.keyFacts")}</h3>

      <div className="space-y-4">
        {/* Population & Area */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="label-caps">{t("facts.population")}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{facts.population}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-primary" />
              <span className="label-caps">{t("facts.area")}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{facts.area_km2} km²</p>
          </div>
        </div>

        {/* Famous Dish */}
        {facts.famous_dish && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Utensils className="w-4 h-4 text-primary" />
              <span className="label-caps">{t("facts.famousDish")}</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{facts.famous_dish}</p>
          </div>
        )}

        {/* Fun Facts */}
        {facts.fun_facts?.length > 0 && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-primary" />
              <span className="label-caps">{t("facts.funFacts")}</span>
            </div>
            <ul className="space-y-1.5">
              {facts.fun_facts.map((f, i) => (
                <li key={i} className="text-xs text-foreground leading-relaxed">• {f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* City Records */}
        {facts.city_records?.length > 0 && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="label-caps">{t("facts.cityRecords")}</span>
            </div>
            <ul className="space-y-1.5">
              {facts.city_records.map((r, i) => (
                <li key={i} className="text-xs text-foreground leading-relaxed">🏆 {r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Average Weather */}
        {facts.avg_weather_by_month?.length > 0 && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Sun className="w-4 h-4 text-primary" />
              <span className="label-caps">{t("facts.avgTemperature")}</span>
            </div>
            <div className="flex items-end gap-1 h-20">
              {facts.avg_weather_by_month.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{m.avg_temp_c}°</span>
                  <div
                    className="w-full rounded-t-sm bg-primary/70"
                    style={{ height: `${Math.max(8, (m.avg_temp_c / maxTemp) * 100)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Touristic Months */}
        <div className="grid grid-cols-2 gap-3">
          {facts.most_touristic_months?.length > 0 && (
            <div className="bg-card rounded-xl p-3 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="label-caps">{t("facts.peakSeason")}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {facts.most_touristic_months.map((m, i) => (
                  <span key={i} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          )}
          {facts.least_touristic_months?.length > 0 && (
            <div className="bg-card rounded-xl p-3 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
                <span className="label-caps">{t("facts.offSeason")}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {facts.least_touristic_months.map((m, i) => (
                  <span key={i} className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* App Rankings */}
        {(visitorRank || ratingRank) && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="label-caps">{t("facts.appRankings")}</span>
            </div>
            <div className="space-y-1.5">
              {visitorRank && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{t("facts.mostVisited")}</span>
                  <span className="text-xs font-bold text-primary">#{visitorRank}</span>
                </div>
              )}
              {ratingRank && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{t("facts.highestRated")}</span>
                  <span className="text-xs font-bold text-primary">#{ratingRank}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
