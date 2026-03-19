import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { StarRating } from "@/components/StarRating";

interface LikedEntry {
  id: string;
  rating: number;
  place: { id: string; name: string; country: string; type: string; image: string | null };
}

export function LikesTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<LikedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, places!inner(id, name, country, type, image)")
        .eq("user_id", user.id)
        .eq("liked", true)
        .order("created_at", { ascending: false });

      if (data) {
        setItems(data.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          place: { id: r.places.id, name: r.places.name, country: r.places.country, type: r.places.type, image: r.places.image },
        })));
      }
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (items.length === 0) {
    return <div className="flex items-center justify-center h-40"><p className="text-sm text-muted-foreground">No liked destinations yet. Like a destination when you log it!</p></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.id} className="relative">
            <div className="aspect-[3/4] w-full">
              <DestinationPoster
                placeId={item.place.id}
                name={item.place.name}
                country={item.place.country}
                type={item.place.type as "city" | "country"}
                image={item.place.image}
                className="w-full h-full"
              />
            </div>
            <div className="mt-1.5 flex justify-center">
              <StarRating rating={item.rating} size={12} />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
