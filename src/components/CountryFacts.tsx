import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Globe, Plane, Utensils, DollarSign, Trophy, Star, Sun, TrendingUp, TrendingDown, Users } from "lucide-react";

interface CountryFactsProps {
  countryName: string;
  placeId: string;
}

interface Facts {
  population: string;
  area_km2: string;
  official_website: string;
  national_airline: string;
  fun_facts: string[];
  national_dish: string;
  currency_name: string;
  currency_code: string;
  currency_to_usd: string;
  country_records: string[];
  famous_celebrities: { name: string; profession: string }[];
  avg_weather_by_month: { month: string; avg_temp_c: number }[];
  most_touristic_months: string[];
  least_touristic_months: string[];
}

export function CountryFacts({ countryName, placeId }: CountryFactsProps) {
  const [facts, setFacts] = useState<Facts | null>(null);
  const [loading, setLoading] = useState(true);
  const [visitorRank, setVisitorRank] = useState<number | null>(null);
  const [ratingRank, setRatingRank] = useState<number | null>(null);

  useEffect(() => {
    fetchFacts();
    fetchRankings();
  }, [countryName]);

  const fetchFacts = async () => {
    setLoading(true);
    try {
      // Check cache first
      const { data: cached } = await supabase
        .from("country_facts" as any)
        .select("facts")
        .eq("country_name", countryName)
        .maybeSingle();

      if (cached?.facts) {
        setFacts(cached.facts as unknown as Facts);
        setLoading(false);
        return;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke("get-country-facts", {
        body: { country_name: countryName },
      });

      if (data && !error) {
        setFacts(data as Facts);
      }
    } catch (e) {
      console.error("Failed to load country facts:", e);
    }
    setLoading(false);
  };

  const fetchRankings = async () => {
    // Get all countries
    const { data: countries } = await supabase
      .from("places")
      .select("id, name")
      .eq("type", "country");

    if (!countries || countries.length === 0) return;

    const countryIds = countries.map((c) => c.id);

    // Get all reviews for countries
    const { data: reviews } = await supabase
      .from("reviews")
      .select("place_id, rating, user_id")
      .in("place_id", countryIds);

    if (!reviews) return;

    // Visitor count per country (unique users)
    const visitorMap = new Map<string, Set<string>>();
    const ratingMap = new Map<string, number[]>();

    reviews.forEach((r) => {
      if (!visitorMap.has(r.place_id)) visitorMap.set(r.place_id, new Set());
      visitorMap.get(r.place_id)!.add(r.user_id);

      if (r.rating != null) {
        if (!ratingMap.has(r.place_id)) ratingMap.set(r.place_id, []);
        ratingMap.get(r.place_id)!.push(Number(r.rating));
      }
    });

    // Rank by visitors
    const visitorRanking = countries
      .map((c) => ({ id: c.id, count: visitorMap.get(c.id)?.size || 0 }))
      .sort((a, b) => b.count - a.count);

    const vIdx = visitorRanking.findIndex((c) => c.id === placeId);
    if (vIdx >= 0) setVisitorRank(vIdx + 1);

    // Rank by avg rating
    const ratingRanking = countries
      .map((c) => {
        const ratings = ratingMap.get(c.id) || [];
        const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        return { id: c.id, avg };
      })
      .filter((c) => c.avg > 0)
      .sort((a, b) => b.avg - a.avg);

    const rIdx = ratingRanking.findIndex((c) => c.id === placeId);
    if (rIdx >= 0) setRatingRank(rIdx + 1);
  };

  if (loading) {
    return (
      <div className="mt-8 space-y-3">
        <h3 className="text-lg font-bold text-foreground">Key Facts</h3>
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!facts) return null;

  const maxTemp = Math.max(...(facts.avg_weather_by_month || []).map((m) => m.avg_temp_c));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 border-t border-border pt-6">
      <h3 className="text-lg font-bold text-foreground mb-5">Key Facts</h3>

      <div className="space-y-4">
        {/* Population & Area */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Population</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{facts.population}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Area</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{facts.area_km2} km²</p>
          </div>
        </div>

        {/* Currency */}
        <div className="bg-card rounded-xl p-3 border border-border">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Currency</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{facts.currency_name} ({facts.currency_code})</p>
          <p className="text-xs text-muted-foreground">{facts.currency_to_usd}</p>
        </div>

        {/* National Dish & Airline */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Utensils className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">National Dish</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{facts.national_dish}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Plane className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Airline</span>
            </div>
            <p className="text-sm font-semibold text-foreground">{facts.national_airline}</p>
          </div>
        </div>

        {/* Official Website */}
        {facts.official_website && (
          <a
            href={facts.official_website}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-card rounded-xl p-3 border border-border hover:border-primary transition-colors"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Official Website →</span>
            </div>
          </a>
        )}

        {/* Fun Facts */}
        {facts.fun_facts?.length > 0 && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Fun Facts</span>
            </div>
            <ul className="space-y-1.5">
              {facts.fun_facts.map((f, i) => (
                <li key={i} className="text-xs text-foreground leading-relaxed">• {f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Country Records */}
        {facts.country_records?.length > 0 && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Country Records</span>
            </div>
            <ul className="space-y-1.5">
              {facts.country_records.map((r, i) => (
                <li key={i} className="text-xs text-foreground leading-relaxed">🏆 {r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Famous Celebrities */}
        {facts.famous_celebrities?.length > 0 && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Famous Celebrities</span>
            </div>
            <div className="space-y-1.5">
              {facts.famous_celebrities.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.profession}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Average Weather */}
        {facts.avg_weather_by_month?.length > 0 && (
          <div className="bg-card rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Sun className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Average Temperature</span>
            </div>
            <div className="flex items-end gap-1 h-20">
              {facts.avg_weather_by_month.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-muted-foreground">{m.avg_temp_c}°</span>
                  <div
                    className="w-full rounded-t-sm bg-primary/70"
                    style={{ height: `${Math.max(8, (m.avg_temp_c / maxTemp) * 100)}%` }}
                  />
                  <span className="text-[8px] text-muted-foreground">{m.month}</span>
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
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Peak Season</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {facts.most_touristic_months.map((m, i) => (
                  <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          )}
          {facts.least_touristic_months?.length > 0 && (
            <div className="bg-card rounded-xl p-3 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Off Season</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {facts.least_touristic_months.map((m, i) => (
                  <span key={i} className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{m}</span>
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
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">App Rankings</span>
            </div>
            <div className="space-y-1.5">
              {visitorRank && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground">Most visited</span>
                  <span className="text-xs font-bold text-primary">#{visitorRank}</span>
                </div>
              )}
              {ratingRank && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground">Highest rated</span>
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
