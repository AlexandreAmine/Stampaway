import { useState, useEffect } from "react";
import { ChevronLeft, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";
import { DestinationPoster } from "@/components/DestinationPoster";
import { toast } from "sonner";

type Step = "search" | "review";

interface PlaceResult {
  id: string;
  name: string;
  country: string;
  type: string;
  image: string | null;
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
  const [step, setStep] = useState<Step>(preSelectedPlaceId ? "review" : "search");
  const [query, setQuery] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(
    preSelectedPlaceId && preSelectedPlaceName
      ? { id: preSelectedPlaceId, name: preSelectedPlaceName, country: preSelectedPlaceCountry || "", type: favoriteType || "city", image: preSelectedPlaceImage || null }
      : null
  );
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [visitYear, setVisitYear] = useState(new Date().getFullYear());
  const [visitMonth, setVisitMonth] = useState(new Date().getMonth() + 1);
  const [durationDays, setDurationDays] = useState<number | "">("");
  const [liked, setLiked] = useState(false);
  const [unknownDate, setUnknownDate] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [recentSearches, setRecentSearches] = useState<PlaceResult[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("recentSearches") || "[]");
      setRecentSearches(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchPlaces(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    fetchPlaces("");
  }, []);

  const fetchPlaces = async (search: string) => {
    // Fetch review counts
    const { data: counts } = await supabase.rpc("get_place_review_counts");
    const countMap = new Map((counts || []).map((c: any) => [c.place_id, Number(c.review_count)]));

    let q = supabase.from("places").select("id, name, country, type, image");
    if (isFavoriteFlow) {
      q = q.eq("type", favoriteType);
    }
    if (search) {
      q = q.ilike("name", `%${search}%`);
    }
    q = q.limit(200);
    const { data } = await q;
    const sorted = (data || []).sort((a, b) => {
      const diff = (countMap.get(b.id) || 0) - (countMap.get(a.id) || 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    }).slice(0, 30);
    setResults(sorted);
  };

  const handleSelectPlace = (place: PlaceResult) => {
    setSelectedPlace(place);
    setStep("review");
  };

  const handleSave = async () => {
    if (!user || !selectedPlace) {
      toast.error("Please select a place");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("reviews").insert({
      user_id: user.id,
      place_id: selectedPlace.id,
      rating: rating > 0 ? rating : null,
      review_text: reviewText || null,
      visit_year: unknownDate ? null : visitYear,
      visit_month: unknownDate ? null : visitMonth,
      duration_days: durationDays || null,
      liked,
    });

    // Auto-remove from wishlist if present
    if (!error) {
      await supabase.from("wishlists").delete().eq("user_id", user.id).eq("place_id", selectedPlace.id);
    }

    // If this is a favorite flow, also save as favorite
    if (!error && isFavoriteFlow) {
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
        await supabase.from("favorite_places").update({ place_id: selectedPlace.id }).eq("id", existing.id);
      } else {
        await supabase.from("favorite_places").insert({
          user_id: user.id,
          place_id: selectedPlace.id,
          slot_index: slotIdx,
          type: favoriteType,
        });
      }
    }

    setSaving(false);

    if (error) {
      toast.error("Failed to save review");
    } else {
      toast.success("Review saved!");
      navigate("/profile");
    }
  };

  if (step === "review" && selectedPlace) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,4%)] pb-24">
        <div className="pt-12 px-5">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("search")}>
                <ChevronLeft className="w-6 h-6 text-foreground" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-14 h-[76px] rounded-lg overflow-hidden shrink-0">
                  {selectedPlace.image ? (
                    <img src={selectedPlace.image} alt={selectedPlace.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/10 to-muted" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">I TravelD to...</p>
                  <h1 className="text-xl font-bold text-foreground">{selectedPlace.name}</h1>
                  <p className="text-xs text-muted-foreground">
                    {selectedPlace.type === "city" ? selectedPlace.country : "Country"}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-primary font-semibold text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">Your rating</p>
              <div className="flex items-center justify-between">
                <StarRating rating={rating} size={40} interactive onChange={setRating} />
                <button type="button" onClick={() => setLiked(!liked)} className="text-2xl transition-transform active:scale-90">
                  {liked ? "❤️" : "🤍"}
                </button>
              </div>
            </div>

            <div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Add a review..."
                className="w-full h-32 bg-card rounded-xl p-4 text-sm text-foreground placeholder:text-muted-foreground resize-none border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">When did you visit?</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-muted-foreground">I don't know</span>
                  <input
                    type="checkbox"
                    checked={unknownDate}
                    onChange={(e) => setUnknownDate(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-card text-primary focus:ring-primary accent-primary"
                  />
                </label>
              </div>
              {!unknownDate && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Year</label>
                    <select
                      value={visitYear}
                      onChange={(e) => setVisitYear(Number(e.target.value))}
                      className="w-full bg-card rounded-xl py-2.5 px-3 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Month</label>
                    <select
                      value={visitMonth}
                      onChange={(e) => setVisitMonth(Number(e.target.value))}
                      className="w-full bg-card rounded-xl py-2.5 px-3 text-sm text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Duration</label>
                    <input
                      type="number"
                      value={durationDays}
                      onChange={(e) => setDurationDays(e.target.value ? Number(e.target.value) : "")}
                      placeholder="Days"
                      min={1}
                      className="w-full bg-card rounded-xl py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">
            {isFavoriteFlow
              ? `Add a Favorite ${favoriteType === "city" ? "City" : "Country"}`
              : "Add a Destination"}
          </h1>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isFavoriteFlow ? `Search ${favoriteType === "city" ? "cities" : "countries"}...` : "Name of destination"}
            className="w-full bg-card rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Recent Searches */}
        {!query && recentSearches.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-muted-foreground mb-3">Recent Searches</p>
            <div className="space-y-0">
              {recentSearches.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handleSelectPlace(place)}
                  className="w-full text-left py-2.5"
                >
                  <p className="text-base font-bold text-foreground">{place.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {results.map((place) => (
            <motion.button
              key={place.id}
              initial={{ opacity: 0 }}
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
