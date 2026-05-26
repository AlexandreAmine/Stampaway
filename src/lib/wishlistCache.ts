import { supabase } from "@/integrations/supabase/client";

export const WISHLIST_CACHE_TTL_MS = 60_000;

type WishlistOverride = { inWishlist: boolean; version: number };
type WishlistListener = () => void;

let cacheUserId: string | null = null;
let cachedPlaceIds: Set<string> | null = null;
let cachedAt = 0;
let inflightRefresh: Promise<void> | null = null;
let mutationVersion = 0;
const overrides = new Map<string, WishlistOverride>();
const listeners = new Set<WishlistListener>();

const notifyWishlistListeners = () => listeners.forEach((listener) => listener());

export function syncWishlistCacheUser(userId: string | null) {
  if (cacheUserId === userId) return;
  cacheUserId = userId;
  cachedPlaceIds = null;
  cachedAt = 0;
  inflightRefresh = null;
  mutationVersion = 0;
  overrides.clear();
  notifyWishlistListeners();
}

export function subscribeToWishlistCache(userId: string, listener: WishlistListener) {
  syncWishlistCacheUser(userId);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCachedWishlistStatus(userId: string, placeId: string) {
  syncWishlistCacheUser(userId);
  const override = overrides.get(placeId);
  if (override) return override.inWishlist;
  return cachedPlaceIds ? cachedPlaceIds.has(placeId) : undefined;
}

export function hasFreshWishlistCache(userId: string) {
  syncWishlistCacheUser(userId);
  return cachedPlaceIds !== null && Date.now() - cachedAt <= WISHLIST_CACHE_TTL_MS;
}

export function setCachedWishlistStatus(userId: string, placeId: string, inWishlist: boolean) {
  syncWishlistCacheUser(userId);
  mutationVersion += 1;
  overrides.set(placeId, { inWishlist, version: mutationVersion });
  if (cachedPlaceIds) {
    if (inWishlist) cachedPlaceIds.add(placeId);
    else cachedPlaceIds.delete(placeId);
  }
  notifyWishlistListeners();
}

export function refreshWishlistCache(userId: string) {
  syncWishlistCacheUser(userId);
  if (inflightRefresh) return inflightRefresh;

  const refreshStartedAtVersion = mutationVersion;
  const request = (async () => {
    const { data, error } = await supabase
      .from("wishlists")
      .select("place_id")
      .eq("user_id", userId);

    if (error) {
      console.error("Wishlist cache refresh failed:", error);
      return;
    }
    if (cacheUserId !== userId) return;

    const nextPlaceIds = new Set(
      (data || [])
        .map((row: { place_id: string | null }) => row.place_id)
        .filter((placeId): placeId is string => Boolean(placeId))
    );

    overrides.forEach((override, placeId) => {
      if (override.version <= refreshStartedAtVersion) {
        overrides.delete(placeId);
        return;
      }
      if (override.inWishlist) nextPlaceIds.add(placeId);
      else nextPlaceIds.delete(placeId);
    });

    cachedPlaceIds = nextPlaceIds;
    cachedAt = Date.now();
    notifyWishlistListeners();
  })();

  inflightRefresh = request;
  request.finally(() => {
    if (inflightRefresh === request) inflightRefresh = null;
  });
  return request;
}
