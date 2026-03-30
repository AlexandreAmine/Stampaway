import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface PosterWishlistButtonProps {
  placeId: string;
  placeName: string;
}

export function PosterWishlistButton({ placeId, placeName }: PosterWishlistButtonProps) {
  const { user } = useAuth();
  const [inWishlist, setInWishlist] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("wishlists")
      .select("id")
      .eq("user_id", user.id)
      .eq("place_id", placeId)
      .maybeSingle()
      .then(({ data }) => setInWishlist(!!data));
  }, [user, placeId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user || toggling) return;
    setToggling(true);
    if (inWishlist) {
      await supabase.from("wishlists").delete().eq("user_id", user.id).eq("place_id", placeId);
      setInWishlist(false);
    } else {
      await supabase.from("wishlists").insert({ user_id: user.id, place_id: placeId });
      setInWishlist(true);
      toast.success(`${placeName} added to wishlist`, { duration: 2000 });
    }
    setToggling(false);
  };

  if (!user) return null;

  return (
    <button
      onClick={handleToggle}
      className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
    >
      <Bookmark
        className={`w-3.5 h-3.5 transition-colors ${
          inWishlist ? "text-primary fill-primary" : "text-white"
        }`}
      />
    </button>
  );
}
