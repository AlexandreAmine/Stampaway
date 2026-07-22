import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { DestinationPoster } from "@/components/DestinationPoster";
import { useSheetTransition } from "@/hooks/useSheetTransition";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchAllPlaces } from "@/lib/placeRankings";
import { matchesPlaceName, normalizeSearchText } from "@/lib/placeSearch";

interface FavoritePickerProps {
  open: boolean;
  onClose: () => void;
  type: "city" | "country";
  onSelect: (placeId: string, placeName: string, placeImage: string | null, placeCountry: string) => void;
}

interface PlaceOption {
  id: string;
  name: string;
  country: string;
  image: string | null;
}

export function FavoritePicker({ open, onClose, type, onSelect }: FavoritePickerProps) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const { closing, requestClose } = useSheetTransition(open, onClose);
  const { language } = useLanguage();

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    fetchPlaces("");
  }, [open, type]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => fetchPlaces(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPlaces = async (search: string) => {
    setLoading(true);
    try {
      // Filter the cached places catalog client-side: matches the English DB
      // name OR the localized name for the active language (FR "espag" finds
      // "Spain" via "Espagne"), accent-insensitive. Same ordering and limit
      // as the previous server query (name A→Z, 50 results).
      const all = await fetchAllPlaces();
      let candidates = all.filter((p: any) => p.type === type);
      if (search) {
        const normalizedQuery = normalizeSearchText(search);
        candidates = candidates.filter((p: any) => matchesPlaceName(p, normalizedQuery, language));
      }
      candidates = [...candidates].sort((a: any, b: any) => a.name.localeCompare(b.name)).slice(0, 50);
      setPlaces(candidates.map((p: any) => ({ id: p.id, name: p.name, country: p.country, image: p.image })));
    } catch {
      setPlaces([]);
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 bg-background/95 flex flex-col"
      >
        <div className="max-w-lg mx-auto w-full flex flex-col h-full">
          <div className="flex items-center justify-between pt-12 px-5 mb-4">
            <h2 className="text-lg font-bold text-foreground">
              Select a {type === "city" ? "City" : "Country"}
            </h2>
            <button onClick={requestClose} className="p-2">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="px-5 mb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                enterKeyHint="search"
                autoCorrect="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${type === "city" ? "cities" : "countries"}...`}
                className="w-full bg-card rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-8">
            <div className="grid grid-cols-3 gap-3">
              {places.map((place) => (
                <button
                  key={place.id}
                  onClick={() => {
                    onSelect(place.id, place.name, place.image, place.country);
                    requestClose();
                  }}
                  className="aspect-[3/4] w-full"
                >
                  <DestinationPoster
                    placeId={place.id}
                    name={place.name}
                    country={place.country}
                    type={type}
                    image={place.image}
                    className="w-full h-full"
                  />
                </button>
              ))}
            </div>
            {!loading && places.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-8">
                No {type === "city" ? "cities" : "countries"} found
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
