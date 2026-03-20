import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DestinationPoster } from "@/components/DestinationPoster";
import { FavoritePicker } from "@/components/FavoritePicker";
import { toast } from "sonner";

interface WishlistItem {
  id: string;
  place: { id: string; name: string; country: string; type: string; image: string | null };
}

export function WishlistTab({ userId, readOnly = false }: { userId?: string; readOnly?: boolean }) {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"country" | "city">("country");
  const [pickerOpen, setPickerOpen] = useState(false);
  const targetUserId = userId || user?.id;

  useEffect(() => {
    if (targetUserId) fetchWishlist();
  }, [targetUserId]);

  const fetchWishlist = async () => {
    if (!targetUserId) return;
    const { data } = await supabase
      .from("wishlists")
      .select("id, places!inner(id, name, country, type, image)")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (data) {
      setItems(data.map((w: any) => ({
        id: w.id,
        place: { id: w.places.id, name: w.places.name, country: w.places.country, type: w.places.type, image: w.places.image },
      })));
    }
    setLoading(false);
  };

  const handleAdd = async (placeId: string) => {
    if (!user) return;
    const exists = items.some((i) => i.place.id === placeId);
    if (exists) { toast("Already in wishlist"); return; }
    const { error } = await supabase.from("wishlists").insert({ user_id: user.id, place_id: placeId });
    if (error) { toast.error("Failed to add"); return; }
    toast.success("Added to wishlist!");
    fetchWishlist();
  };

  const handleRemove = async (wishlistId: string) => {
    await supabase.from("wishlists").delete().eq("id", wishlistId);
    toast.success("Removed from wishlist");
    fetchWishlist();
  };

  const filtered = items.filter((i) => i.place.type === subTab);

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["country", "city"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors ${
                subTab === t ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {t === "country" ? "Countries" : "Cities"}
            </button>
          ))}
        </div>
        <button onClick={() => setPickerOpen(true)} className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Plus className="w-4 h-4 text-primary" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-muted-foreground">No {subTab === "country" ? "countries" : "cities"} in wishlist</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((item) => (
            <div key={item.id} className="relative aspect-[3/4]">
              <DestinationPoster
                placeId={item.place.id}
                name={item.place.name}
                country={item.place.country}
                type={item.place.type as "city" | "country"}
                image={item.place.image}
                className="w-full h-full"
              />
              <button
                onClick={() => handleRemove(item.id)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <FavoritePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        type={subTab}
        onSelect={(placeId) => { handleAdd(placeId); setPickerOpen(false); }}
      />
    </motion.div>
  );
}
