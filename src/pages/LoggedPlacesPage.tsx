import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StarRating } from "@/components/StarRating";

interface LoggedPlace {
  place_id: string;
  place_name: string;
  place_country: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

export default function LoggedPlacesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "city";
  const { user } = useAuth();
  const [places, setPlaces] = useState<LoggedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchLoggedPlaces();
  }, [user, type]);

  const fetchLoggedPlaces = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reviews")
      .select("place_id, rating, review_text, created_at, places!inner(name, country, type)")
      .eq("user_id", user!.id)
      .eq("places.type", type)
      .order("created_at", { ascending: false });

    if (data) {
      setPlaces(
        data.map((r: any) => ({
          place_id: r.place_id,
          place_name: r.places.name,
          place_country: r.places.country,
          rating: r.rating,
          review_text: r.review_text,
          created_at: r.created_at,
        }))
      );
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
          <h1 className="text-xl font-bold text-foreground">
            My {type === "city" ? "Cities" : "Countries"}
          </h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground text-sm">Loading...</p>
          </div>
        ) : places.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-muted-foreground text-sm">
              No {type === "city" ? "cities" : "countries"} logged yet
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {places.map((place, i) => (
              <motion.div
                key={place.place_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between py-3 border-b border-border"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{place.place_name}</p>
                  {type === "city" && (
                    <p className="text-xs text-muted-foreground">{place.place_country}</p>
                  )}
                </div>
                <StarRating rating={place.rating} size={14} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
