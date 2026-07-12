// Explore snapshot cache with localStorage persistence.
//
// ExplorePage ALWAYS refetches silently when it renders from this cache, so
// serving old snapshots is safe (stale-while-revalidate): the user sees the
// last known sections instantly — including on a cold app start — and the
// data refreshes in place. The TTL below only bounds how old a snapshot may
// be to still qualify for that instant first paint.
export const EXPLORE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEY = "stampaway_explore_cache_v1";

type ExploreCacheEntry<T> = {
  data: T;
  cachedAt: number;
};

type PersistedShape = {
  userId: string | null;
  entries: Record<string, ExploreCacheEntry<unknown>>;
};

const exploreCache = new Map<string, ExploreCacheEntry<unknown>>();
let exploreCacheUserId: string | null = null;
let exploreCacheVersion = 0;
let hydratedFromStorage = false;

function hydrateForUser(userId: string | null) {
  if (hydratedFromStorage || !userId) return;
  hydratedFromStorage = true;
  try {
    const stored: PersistedShape = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!stored || stored.userId !== userId) return;
    const now = Date.now();
    Object.entries(stored.entries || {}).forEach(([key, entry]) => {
      if (entry && typeof entry.cachedAt === "number" && now - entry.cachedAt <= EXPLORE_CACHE_TTL_MS) {
        exploreCache.set(key, entry);
      }
    });
  } catch {}
}

let persistTimer: number | null = null;
function schedulePersist() {
  if (typeof window === "undefined" || persistTimer !== null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    try {
      const shape: PersistedShape = {
        userId: exploreCacheUserId,
        entries: Object.fromEntries(exploreCache.entries()),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shape));
    } catch {}
  }, 1000);
}

export function syncExploreCacheUser(userId: string | null) {
  if (exploreCacheUserId === userId) {
    hydrateForUser(userId);
    return;
  }

  exploreCacheUserId = userId;
  exploreCacheVersion += 1;
  exploreCache.clear();
  hydrateForUser(userId);
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
  schedulePersist();
}

export function invalidateExploreCache(userId: string | null) {
  syncExploreCacheUser(userId);
  if (!userId) return;

  exploreCacheVersion += 1;
  exploreCache.clear();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
