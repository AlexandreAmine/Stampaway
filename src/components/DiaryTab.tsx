import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { StarRating } from "@/components/StarRating";

interface DiaryEntry {
  id: string;
  rating: number | null;
  liked: boolean;
  review_text: string | null;
  visit_year: number | null;
  visit_month: number | null;
  duration_days: number | null;
  created_at: string;
  place: {
    id: string;
    name: string;
    country: string;
    type: string;
    image: string | null;
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DiaryTab({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"country" | "city">("country");
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (!targetUserId) return;
    fetchDiary();
  }, [targetUserId]);

  const fetchDiary = async () => {
    if (!targetUserId) return;
    const { data } = await supabase
      .from("reviews")
      .select("id, rating, liked, review_text, visit_year, visit_month, duration_days, created_at, places!inner(id, name, country, type, image)")
      .eq("user_id", targetUserId)
      .order("visit_year", { ascending: false, nullsFirst: false })
      .order("visit_month", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (data) {
      const mapped: DiaryEntry[] = data.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        liked: r.liked || false,
        review_text: r.review_text,
        visit_year: r.visit_year,
        visit_month: r.visit_month,
        duration_days: r.duration_days,
        created_at: r.created_at,
        place: {
          id: r.places.id,
          name: r.places.name,
          country: r.places.country,
          type: r.places.type,
          image: r.places.image,
        },
      }));
      setEntries(mapped);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground text-sm">No diary entries yet. Log a destination to start!</p>
      </div>
    );
  }

  const filtered = entries.filter((e) => e.place.type === section);

  // Group by year
  const grouped: Record<number | string, DiaryEntry[]> = {};
  filtered.forEach((e) => {
    const key = e.visit_year || "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(e);
  });

  const sortedYears = Object.keys(grouped).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return Number(b) - Number(a);
  });

  const countryCount = entries.filter((e) => e.place.type === "country").length;
  const cityCount = entries.filter((e) => e.place.type === "city").length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Section toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSection("country")}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${section === "country" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}
        >
          Countries ({countryCount})
        </button>
        <button
          onClick={() => setSection("city")}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${section === "city" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}
        >
          Cities ({cityCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground text-sm">No {section === "country" ? "country" : "city"} entries yet</p>
        </div>
      ) : (
      {sortedYears.map((year) => (
        <div key={year}>
          <h3 className="text-lg font-bold text-foreground mb-3">{year}</h3>
          <div className="space-y-3">
            {grouped[year].map((entry) => (
              <button key={entry.id} onClick={() => navigate(`/place/${entry.place.id}`)} className="flex gap-3 bg-card rounded-xl p-3 border border-border w-full text-left">
                <div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden">
                  <DestinationPoster
                    placeId={entry.place.id}
                    name={entry.place.name}
                    country={entry.place.country}
                    type={entry.place.type as "city" | "country"}
                    image={entry.place.image}
                    className="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{entry.place.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.visit_month ? MONTHS[entry.visit_month - 1] + " " : ""}
                    {entry.visit_year || ""}
                    {entry.duration_days ? ` · ${entry.duration_days} day${entry.duration_days > 1 ? "s" : ""}` : ""}
                  </p>
                   {entry.rating != null ? (
                      <div className="mt-1">
                        <StarRating rating={entry.rating} size={14} liked={entry.liked} />
                      </div>
                   ) : (
                     <p className="text-xs text-muted-foreground mt-1">No rating</p>
                   )}
                  {entry.review_text && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.review_text}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
