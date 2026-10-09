import { useState, useEffect, useRef } from "react";
import { sizedPosterUrl } from "@/lib/imageSizing";
import { dismissModal } from "@/lib/backTransition";
import { ChevronLeft, Search, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { RecentSearches } from "@/components/RecentSearches";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { hapticSuccess } from "@/lib/haptics";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";
import { allRpcRows, fetchAllPlaces } from "@/lib/placeRankings";
import { matchesPlaceName, normalizeSearchText } from "@/lib/placeSearch";
import { useLocalizedPlaceName } from "@/hooks/useLocalizedPlaceName";
import { ReviewFormFields, useFollowingLookup } from "@/components/ReviewFormFields";
import { emptyReviewDraft, saveReview, type ReviewDraft } from "@/lib/reviewDraft";
import { getCachedPlaceName } from "@/lib/placeNames";
import { compareText } from "@/lib/compareText";

type Step = "search" | "review";

interface PlaceResult {
  id: string;
  name: string;
  country: string;
  type: string;
  image: string | null;
}

/** The country page for `countryName`, if `userId` hasn't logged that country yet. */
async function findUnloggedCountry(userId: string, countryName: string) {
  const { data: countryPlace } = await supabase
    .from("places")
    .select("id, name, country, image")
    .eq("type", "country")
    .eq("name", countryName)
    .maybeSingle();
  if (!countryPlace) return null;

  const { data: countryReview } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", userId)
    .eq("place_id", countryPlace.id)
    .limit(1);
  return countryReview && countryReview.length > 0 ? null : countryPlace;
}

// Review counts only order the search results, so they're fetched once and
// reused while typing and when the screen is reopened shortly after, instead
// of on every keystroke.
const REVIEW_COUNTS_TTL_MS = 5 * 60 * 1000;
let reviewCounts: { request: Promise<Map<string, number>>; at: number } | null = null;

function getReviewCountMap(): Promise<Map<string, number>> {
  if (reviewCounts && Date.now() - reviewCounts.at < REVIEW_COUNTS_TTL_MS) return reviewCounts.request;
  const request = allRpcRows((from, to) =>
    supabase.rpc("get_place_review_counts").order("place_id").range(from, to)
  ).then((rows) => new Map<string, number>(rows.map((count: any) => [count.place_id, Number(count.review_count)])));
  const entry = { request, at: Date.now() };
  reviewCounts = entry;
  // A failed request is retried on the next search.
  request.catch(() => {
    if (reviewCounts === entry) reviewCounts = null;
  });
  return request;
}

export default function AddPlacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const favoriteType = searchParams.get("favoriteType") as "city" | "country" | null;
  const favoriteSlot = searchParams.get("favoriteSlot");
  const isFavoriteFlow = favoriteType !== null && favoriteSlot !== null;
  const preSelectedPlaceId = searchParams.get("placeId");
  const preSelectedPlaceName = searchParams.get("placeName");
  const preSelectedPlaceCountry = searchParams.get("placeCountry");
  const preSelectedPlaceImage = searchParams.get("placeImage");

  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [step, setStep] = useState<Step>(preSelectedPlaceId ? "review" : "search");

  // This screen is presented as a modal (see RouteTransition): closing it
  // sinks it back down to wherever it was opened from.
  const closeAdd = () =>
    dismissModal(() => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) navigate(-1);
      else navigate("/", { replace: true });
    });
  const [query, setQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(
    preSelectedPlaceId && preSelectedPlaceName
      ? { id: preSelectedPlaceId, name: preSelectedPlaceName, country: preSelectedPlaceCountry || "", type: favoriteType || "city", image: preSelectedPlaceImage || null }
      : null
  );
  // The search results show localized names ("Lisbonne"); the review header
  // must match rather than fall back to the stored English name.
  const localizedPlaceName = useLocalizedPlaceName(selectedPlace?.name, selectedPlace?.type === "country");
  const localizedPlaceCountry = useLocalizedPlaceName(selectedPlace?.country, true);
  const [draft, setDraft] = useState<ReviewDraft>(emptyReviewDraft);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [saving, setSaving] = useState(false);
  // Read during the first render so the grid below doesn't jump down a
  // frame later when the recents appear.
  const [recentSearches] = useState<PlaceResult[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("recentSearches") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const followingLookup = useFollowingLookup();
  const placeSearchRequestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++placeSearchRequestIdRef.current;
    const delay = query ? 200 : 0; // fetch immediately on mount
    const timer = setTimeout(() => {
      void fetchPlaces(query, requestId);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (placeSearchRequestIdRef.current === requestId) {
        placeSearchRequestIdRef.current += 1;
      }
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPlaces = async (search: string, requestId: number) => {
    try {
      // Filter the cached places catalog client-side: matches the English DB
      // name OR the localized name for the active language (FR "espag" finds
      // "Spain" via "Espagne"), accent-insensitive — and search-as-you-type
      // no longer needs a network round-trip per keystroke.
      const [countMap, allPlaces] = await Promise.all([
        getReviewCountMap(),
        fetchAllPlaces(),
      ]);
      if (placeSearchRequestIdRef.current !== requestId) return;

      let candidates = allPlaces as PlaceResult[];
      if (isFavoriteFlow) candidates = candidates.filter((p) => p.type === favoriteType);
      if (search) {
        const normalizedQuery = normalizeSearchText(search);
        candidates = candidates.filter((p) => matchesPlaceName(p, normalizedQuery, language));
      }

      const sorted = [...candidates]
        .sort((a, b) => {
          const diff = (countMap.get(b.id) || 0) - (countMap.get(a.id) || 0);
          return diff !== 0 ? diff : compareText(a.name, b.name);
        })
        .slice(0, 30);
      setResults(sorted);
    } catch {
      if (placeSearchRequestIdRef.current === requestId) {
        console.error("Failed to search Add Place destinations");
      }
    }
  };

  const handleSelectPlace = (place: PlaceResult) => {
    setSelectedPlace(place);
    setStep("review");
  };

  const handleSave = async () => {
    if (!user || !selectedPlace) {
      toastError(t("review.selectPlace"));
      return;
    }
    setSaving(true);
    // Logging a city whose country isn't logged yet offers to log the country
    // too. Looked up alongside the save (not after it), so the offer appears
    // as the profile opens instead of popping up a moment later.
    const unloggedCountryPromise =
      selectedPlace.type === "city" && selectedPlace.country
        ? findUnloggedCountry(user.id, selectedPlace.country).catch(() => null)
        : Promise.resolve(null);
    const currentYear = new Date().getFullYear();
    // Add-screen extras, saved in the same batch as the tags and sub-ratings.
    const afterInsert = async (reviewId: string | undefined) => {
      // Check if this is a first-time visit (new destination) and user has yearly goals
      const showGoalProgress = async () => {
        const { data: previousReviews } = await supabase
          .from("reviews")
          .select("id")
          .eq("user_id", user.id)
          .eq("place_id", selectedPlace.id)
          .neq("id", reviewId || "")
          .limit(1);

        const isNewDestination = !previousReviews || previousReviews.length === 0;
        if (!isNewDestination) return;

        const { data: yearlyGoals } = await supabase
          .from("yearly_goals")
          .select("continent, country_goal, city_goal")
          .eq("user_id", user.id)
          .eq("year", currentYear);

        if (!yearlyGoals || yearlyGoals.length === 0) return;

        const totalGoal = yearlyGoals.find(g => g.continent === "total");
        const placeType = selectedPlace.type === "country" ? "country" : "city";
        const goalKey = placeType === "country" ? "country_goal" : "city_goal";
        const totalTarget = totalGoal?.[goalKey] || 0;
        if (totalTarget <= 0) return;

        // Count new destinations this year
        const { data: allReviews } = await supabase
          .from("reviews")
          .select("place_id, visit_year, places!inner(type)")
          .eq("user_id", user.id);
        if (!allReviews) return;

        const firstYear: Record<string, number | null> = {};
        allReviews.forEach((r: any) => {
          if (!(r.place_id in firstYear)) firstYear[r.place_id] = r.visit_year;
          else if (r.visit_year && (firstYear[r.place_id] === null || r.visit_year < firstYear[r.place_id]!))
            firstYear[r.place_id] = r.visit_year;
        });
        const newCount = Object.entries(firstYear).filter(([pid, yr]) => {
          if (yr !== currentYear) return false;
          const rev = allReviews.find(r => r.place_id === pid);
          return rev && (rev as any).places?.type === (placeType === "country" ? "country" : "city");
        }).length;

        toast.success(
          t(placeType === "country" ? "review.newCountry" : "review.newCity", {
            count: String(newCount),
            target: String(totalTarget),
          }),
          { duration: 2000 }
        );
      };

      // If this is a favorite flow, also save as favorite
      const saveFavorite = async () => {
        if (!isFavoriteFlow) return;
        const slotIdx = Number(favoriteSlot);
        // Check if slot already has a favorite
        const { data: existing } = await supabase
          .from("favorite_places")
          .select("id")
          .eq("user_id", user.id)
          .eq("slot_index", slotIdx)
          .eq("type", favoriteType)
          .maybeSingle();

        if (existing) {
          const { error: favError } = await supabase.from("favorite_places").update({ place_id: selectedPlace.id }).eq("id", existing.id);
          if (!favError) invalidateOwnProfileContentCache(user.id);
        } else {
          const { error: favError } = await supabase.from("favorite_places").insert({
            user_id: user.id,
            place_id: selectedPlace.id,
            slot_index: slotIdx,
            type: favoriteType,
          });
          if (!favError) invalidateOwnProfileContentCache(user.id);
        }
      };

      await Promise.all([showGoalProgress(), saveFavorite()]);
    };
    const reviewId = await saveReview(user.id, selectedPlace, draft, afterInsert);
    const error = reviewId === null;

    setSaving(false);

    if (error) {
      toastError(t("review.saveFailed"));
    } else {
      hapticSuccess();
      toast.success(t("review.saved"));

      // If the user logged a city and hasn't logged its country, offer it
      // (navigation continues normally, as for any other log).
      void unloggedCountryPromise.then((countryPlace) => {
        if (!countryPlace) return;
        toast(
          t("review.logCountryPrompt", {
            country: getCachedPlaceName(countryPlace.name, language, true),
          }),
          {
            // Long enough to read and act on after arriving on the profile.
            duration: 8000,
            className: "!text-base !p-5 !min-h-[72px]",
            action: {
              label: t("review.logAction"),
              onClick: () => {
                navigate(
                  `/add?placeId=${countryPlace.id}&placeName=${encodeURIComponent(countryPlace.name)}&placeCountry=${encodeURIComponent(countryPlace.country || "")}&placeImage=${encodeURIComponent(countryPlace.image || "")}`
                );
              },
            },
          }
        );
      });

      navigate("/profile");
    }
  };

  if (step === "review" && selectedPlace) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,4%)] pb-44 overflow-y-auto">
        <div className="pt-12 px-5">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              {/* Opened on a specific place: back closes the screen. Otherwise
                  it returns to the search. */}
              <button onClick={() => (preSelectedPlaceId ? closeAdd() : setStep("search"))} aria-label={t("back")}>
                <ChevronLeft className="w-6 h-6 text-foreground" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-14 h-[76px] rounded-lg overflow-hidden shrink-0">
                  {selectedPlace.image ? (
                    <img src={sizedPosterUrl(selectedPlace.image, 400) || selectedPlace.image} alt={selectedPlace.name} decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-muted" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("review.iStamped")}</p>
                  <h1 className="text-xl font-bold text-foreground">{localizedPlaceName || selectedPlace.name}</h1>
                  <p className="text-xs text-muted-foreground">
                    {selectedPlace.type === "city" ? localizedPlaceCountry || selectedPlace.country : t("common.country")}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-primary font-semibold text-sm disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("save")}
            </button>
          </div>

          <ReviewFormFields draft={draft} onChange={setDraft} followingLookup={followingLookup} />
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] pb-24">
      <div className="pt-14 px-5">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h1 className="page-title">
            {isFavoriteFlow
              ? t(favoriteType === "city" ? "add.favoriteCityTitle" : "add.favoriteCountryTitle")
              : t("add.title")}
          </h1>
          <button
            type="button"
            onClick={closeAdd}
            aria-label={t("common.close")}
            className="w-9 h-9 -mr-1 rounded-full bg-secondary flex items-center justify-center active:scale-95 transition-transform"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            enterKeyHint="search"
            autoCorrect="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isFavoriteFlow
                ? t(favoriteType === "city" ? "add.searchCities" : "add.searchCountries")
                : t("add.namePlaceholder")
            }
            className="w-full bg-card rounded-lg py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <RecentSearches
            places={recentSearches}
            onSelect={(place) => handleSelectPlace(place as PlaceResult)}
          />
        )}

        <div className="grid grid-cols-3 gap-3">
          {results.map((place) => (
            <motion.button
              key={place.id}
              initial={false}
              animate={{ opacity: 1 }}
              onClick={() => handleSelectPlace(place)}
              className="aspect-[3/4] w-full"
            >
              <DestinationPoster
                placeId={place.id}
                name={place.name}
                country={place.country}
                type={place.type as "city" | "country"}
                image={place.image}
                className="w-full h-full"
              />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
