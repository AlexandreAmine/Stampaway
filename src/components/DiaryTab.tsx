import { useState } from "react";
import { placeLinkProps } from "@/lib/placePrimaryQuery";
import { hapticSelection } from "@/lib/haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { monthShortNames } from "@/lib/localeFormat";
import { DestinationPoster } from "@/components/DestinationPoster";
import { StarRating } from "@/components/StarRating";
import { DiaryEditSheet } from "@/components/DiaryEditSheet";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";
import { invalidateExploreCache } from "@/lib/exploreCache";
import { clearRankingsCache } from "@/lib/placeRankings";

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

export function DiaryTab({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const { t, tn, language } = useLanguage();
  const months = monthShortNames(language);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<"country" | "city">("country");
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const targetUserId = userId || user?.id;
  const isOwnProfile = !userId || userId === user?.id;

  // Cached by React Query: reopening this tab renders instantly from the
  // last known data while a background refetch keeps it fresh.
  const diaryQuery = useQuery({
    queryKey: ["diary", targetUserId ?? null],
    enabled: !!targetUserId,
    queryFn: async (): Promise<DiaryEntry[]> => {
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, liked, review_text, visit_year, visit_month, duration_days, created_at, places!inner(id, name, country, type, image)")
        .eq("user_id", targetUserId!)
        .order("visit_year", { ascending: false, nullsFirst: false })
        .order("visit_month", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

      return (data || []).map((r: any) => ({
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
    },
  });
  const entries = diaryQuery.data ?? [];
  const loading = diaryQuery.isPending;

  const refreshDiary = () =>
    queryClient.invalidateQueries({ queryKey: ["diary", targetUserId ?? null] });

  const handleDelete = async (entryId: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", entryId);
    if (error) {
      toastError(t("diary.deleteFailed"));
      return;
    }
    toast.success(t("toast.entryDeleted"));
    if (user?.id) {
      invalidateOwnProfileContentCache(user.id);
      clearRankingsCache();
      invalidateExploreCache(user.id);
    }
    queryClient.setQueryData(["diary", targetUserId ?? null], (old?: DiaryEntry[]) =>
      (old ?? []).filter((e) => e.id !== entryId)
    );
  };

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-muted/40 rounded-xl skeleton-shimmer" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground text-sm">{t("diary.emptyCta")}</p>
      </div>
    );
  }

  const filtered = entries.filter((e) => e.place.type === section);

  // Count unique places per year (deduplicate by place id)
  const uniquePlacesPerYear: Record<string, Set<string>> = {};
  filtered.forEach((e) => {
    const key = String(e.visit_year || "Unknown");
    if (!uniquePlacesPerYear[key]) uniquePlacesPerYear[key] = new Set();
    uniquePlacesPerYear[key].add(e.place.id);
  });

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Section toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { if (section !== "country") hapticSelection(); setSection("country"); }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${section === "country" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}
        >
          {t("profile.countries")}
        </button>
        <button
          onClick={() => { if (section !== "city") hapticSelection(); setSection("city"); }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${section === "city" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"}`}
        >
          {t("profile.cities")}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground text-sm">{t(section === "country" ? "diary.noCountryEntries" : "diary.noCityEntries")}</p>
        </div>
      ) : (
        <div className="space-y-6">
        {sortedYears.map((year) => (
        <div key={year}>
          <h3 className="text-lg font-bold text-foreground mb-3">
            {year === "Unknown" ? t("common.unknown") : year}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({tn(section === "country" ? "count.country" : "count.city", uniquePlacesPerYear[String(year)]?.size || 0)})
            </span>
          </h3>
          <div className="space-y-3">
            {grouped[year].map((entry) => (
              <div key={entry.id} className="flex gap-3 bg-card rounded-xl p-3 border border-border w-full">
                <button onClick={() => navigate(`/place/${entry.place.id}`)} {...placeLinkProps(entry.place.id)} className="w-16 h-20 shrink-0 rounded-lg overflow-hidden">
                  <DestinationPoster
                    placeId={entry.place.id}
                    name={entry.place.name}
                    country={entry.place.country}
                    type={entry.place.type as "city" | "country"}
                    image={entry.place.image}
                    className="w-full h-full"
                  />
                </button>
                <button onClick={() => navigate(`/place/${entry.place.id}`)} {...placeLinkProps(entry.place.id)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-bold text-foreground truncate">{entry.place.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.visit_month ? months[entry.visit_month - 1] + " " : ""}
                    {entry.visit_year || ""}
                    {entry.duration_days ? ` · ${tn("count.day", entry.duration_days)}` : ""}
                  </p>
                   {entry.rating != null ? (
                     <div className="mt-1">
                       <StarRating rating={entry.rating} size={14} liked={entry.liked} />
                     </div>
                   ) : (
                     <p className="text-xs text-muted-foreground mt-1">{t("common.noRating")}</p>
                   )}
                  {entry.review_text && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2" data-no-translate>{entry.review_text}</p>
                  )}
                </button>
                {isOwnProfile && (
                  <div className="flex flex-col gap-1 self-center shrink-0">
                    <button
                      onClick={() => setEditingEntry(entry)}
                      className="p-1.5"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1.5"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
        </div>
      )}
      {editingEntry && (
        <DiaryEditSheet
          entry={editingEntry}
          open={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => void refreshDiary()}
        />
      )}
    </motion.div>
  );
}
