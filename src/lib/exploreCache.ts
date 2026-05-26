export const EXPLORE_CACHE_TTL_MS = 60_000;

type ExploreCacheEntry<T> = {
  data: T;
  cachedAt: number;
};

const exploreCache = new Map<string, ExploreCacheEntry<unknown>>();
let exploreCacheUserId: string | null = null;
let exploreCacheVersion = 0;

export function syncExploreCacheUser(userId: string | null) {
  if (exploreCacheUserId === userId) return;

  exploreCacheUserId = userId;
  exploreCacheVersion += 1;
  exploreCache.clear();
}

export function getExploreCacheVersion() {
  return exploreCacheVersion;
}

export function isExploreCacheVersion(version: number) {
  return exploreCacheVersion === version;
}

export function getFreshExploreCache<T>(userId: string | null, key: string): T | null {
  syncExploreCacheUser(userId);

  const entry = exploreCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > EXPLORE_CACHE_TTL_MS) {
    exploreCache.delete(key);
    return null;
  }

  return entry.data as T;
}

export function setExploreCache<T>(userId: string | null, key: string, data: T) {
  syncExploreCacheUser(userId);

  exploreCache.set(key, {
    data,
    cachedAt: Date.now(),
  });
}

export function invalidateExploreCache(userId: string | null) {
  syncExploreCacheUser(userId);
  if (!userId) return;

  exploreCacheVersion += 1;
  exploreCache.clear();
}
