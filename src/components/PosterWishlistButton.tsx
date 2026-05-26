import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  getCachedWishlistStatus,
  hasFreshWishlistCache,
  refreshWishlistCache,
  setCachedWishlistStatus,
  subscribeToWishlistCache,
  syncWishlistCacheUser,
} from "@/lib/wishlistCache";
import { invalidateOwnProfileContentCache } from "@/lib/profileContentCache";

interface PosterWishlistButtonProps {
  placeId: string;
  placeName: string;
}

export function PosterWishlistButton({ placeId, placeName }: PosterWishlistButtonProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [inWishlist, setInWishlist] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    syncWishlistCacheUser(userId);
    if (!userId) {
      setInWishlist(false);
      return;
    }

    let cancelled = false;
    const applyCachedStatus = () => {
      const cachedStatus = getCachedWishlistStatus(userId, placeId);
      if (cancelled) return;
      setInWishlist(cachedStatus ?? false);
    };

    applyCachedStatus();
    const unsubscribe = subscribeToWishlistCache(userId, applyCachedStatus);
    if (!hasFreshWishlistCache(userId)) refreshWishlistCache(userId).then(applyCachedStatus);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, placeId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!userId || toggling) return;
    setToggling(true);
    try {
      if (inWishlist) {
        const { error } = await supabase.from("wishlists").delete().eq("user_id", userId).eq("place_id", placeId);
        if (error) throw error;
        setInWishlist(false);
        setCachedWishlistStatus(userId, placeId, false);
        invalidateOwnProfileContentCache(userId);
      } else {
        const { error } = await supabase.from("wishlists").insert({ user_id: userId, place_id: placeId });
        if (error) throw error;
        setInWishlist(true);
        setCachedWishlistStatus(userId, placeId, true);
        invalidateOwnProfileContentCache(userId);
        toast.success(`${placeName} added to wishlist`, { duration: 2000 });
      }
    } catch (error) {
      console.error("Wishlist toggle failed:", error);
    } finally {
      setToggling(false);
    }
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
