import { useState, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { StarRating } from "@/components/StarRating";

export default function CountryCitiesPage() {
  const { countryName } = useParams<{ countryName: string }>();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "all"; // "all" or "wishlist"
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cities, setCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (countryName) fetchCities();
  }, [countryName, mode]);

  const fetchCities = async () => {
    if (!countryName) return;
    setLoading(true);
    const decoded = decodeURIComponent(countryName);

    if (mode === "wishlist" && user) {
      // Cities in this country that are on user's wishlist
      const { data: wishlistData } = await supabase
        .from("wishlists")
        .select("place_id, places!inner(id, name, country, type, image)")
        .eq("user_id", user.id);

      const wishCities = (wishlistData || [])
        .filter((w: any) => w.places.type === "city" && w.places.country === decoded)
        .map((w: any) => ({ ...w.places, review_count: 0 }));

      // Get review counts
      if (wishCities.length > 0) {
        const ids = wishCities.map((c: any) => c.id);
        const { data: reviews } = await supabase
          .from("reviews")
          .select("place_id")
          .in("place_id", ids);

        const counts = new Map<string, number>();
        (reviews || []).forEach((r) => {
          counts.set(r.place_id, (counts.get(r.place_id) || 0) + 1);
        });
        wishCities.forEach((c: any) => { c.review_count = counts.get(c.id) || 0; });
      }

      setCities(wishCities.sort((a: any, b: any) => b.review_count - a.review_count));
    } else {
      // All cities in this country, most logged first
      const { data: placesData } = await supabase
        .from("places")
        .select("id, name, country, type, image")
        .eq("type", "city")
        .eq("country", decoded);

      const allCities = placesData || [];

      if (allCities.length > 0) {
        const ids = allCities.map((c) => c.id);
        const { data: reviews } = await supabase
          .from("reviews")
          .select("place_id")
          .in("place_id", ids);

        const counts = new Map<string, number>();
        (reviews || []).forEach((r) => {
          counts.set(r.place_id, (counts.get(r.place_id) || 0) + 1);
        });

        const withCounts = allCities.map((c) => ({ ...c, review_count: counts.get(c.id) || 0 }));
        setCities(withCounts.sort((a, b) => b.review_count - a.review_count));
      } else {
        setCities([]);
      }
    }

    setLoading(false);
  };

  const decoded = countryName ? decodeURIComponent(countryName) : "";
  const title = mode === "wishlist" ? `Wishlist · ${decoded}` : `Cities in ${decoded}`;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="pt-12 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}>
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            {mode === "wishlist" ? "No cities from this country in your wishlist" : "No cities found"}
          </p>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-2.5">
            {cities.map((city) => (
              <button
                key={city.id}
                onClick={() => navigate(`/place/${city.id}`)}
                className="relative text-left"
              >
                <div className="aspect-[3/4] w-full">
                  <DestinationPoster
                    placeId={city.id}
                    name={city.name}
                    country={city.country}
                    type="city"
                    image={city.image}
                    autoGenerate
                    className="w-full h-full"
                  />
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
