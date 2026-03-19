import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface FavoritePickerProps {
  open: boolean;
  onClose: () => void;
  type: "city" | "country";
  onSelect: (placeId: string, placeName: string) => void;
}

interface PlaceOption {
  id: string;
  name: string;
  country: string;
}

export function FavoritePicker({ open, onClose, type, onSelect }: FavoritePickerProps) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [loading, setLoading] = useState(false);

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
    let q = supabase.from("places").select("id, name, country").eq("type", type);
    if (search) {
      q = q.ilike("name", `%${search}%`);
    }
    q = q.order("name").limit(50);
    const { data } = await q;
    setPlaces(data || []);
    setLoading(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 flex flex-col"
      >
        <div className="max-w-lg mx-auto w-full flex flex-col h-full">
          <div className="flex items-center justify-between pt-12 px-5 mb-4">
            <h2 className="text-lg font-bold text-foreground">
              Select a {type === "city" ? "City" : "Country"}
            </h2>
            <button onClick={onClose} className="p-2">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="px-5 mb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${type === "city" ? "cities" : "countries"}...`}
                className="w-full bg-card rounded-xl py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-8">
            {places.map((place) => (
              <button
                key={place.id}
                onClick={() => {
                  onSelect(place.id, place.name);
                  onClose();
                }}
                className="w-full text-left py-3 border-b border-border flex items-center justify-between hover:bg-card/50 transition-colors"
              >
                <div>
                  <span className="text-sm font-medium text-foreground">{place.name}</span>
                  {type === "city" && (
                    <span className="text-xs text-muted-foreground ml-2">{place.country}</span>
                  )}
                </div>
              </button>
            ))}
            {!loading && places.length === 0 && (
              <p className="text-sm text-muted-foreground text-center mt-8">No {type === "city" ? "cities" : "countries"} found</p>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
