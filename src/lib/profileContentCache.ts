export const OWN_PROFILE_CONTENT_CACHE_TTL_MS = 60_000;

let ownProfileContentCacheUserId: string | null = null;
let ownProfileContentCacheVersion = 0;
let ownProfileContentCache: { data: unknown; ts: number } | null = null;

export function syncOwnProfileContentCacheUser(userId: string | null) {
  if (ownProfileContentCacheUserId === userId) return;
  ownProfileContentCacheUserId = userId;
  ownProfileContentCacheVersion += 1;
  ownProfileContentCache = null;
}

export function getOwnProfileContentCacheVersion() {
  return ownProfileContentCacheVersion;
}

export function isOwnProfileContentCacheVersion(version: number) {
  return ownProfileContentCacheVersion === version;
}

export function getFreshOwnProfileContentCache<T>(userId: string | null) {
  syncOwnProfileContentCacheUser(userId);
  if (!userId || !ownProfileContentCache) return null;
  if (Date.now() - ownProfileContentCache.ts > OWN_PROFILE_CONTENT_CACHE_TTL_MS) {
    ownProfileContentCache = null;
    return null;
  }
  return ownProfileContentCache.data as T;
}

export function setOwnProfileContentCache<T>(userId: string | null, data: T) {
  syncOwnProfileContentCacheUser(userId);
  if (!userId) return;
  ownProfileContentCache = { data, ts: Date.now() };
}

export function invalidateOwnProfileContentCache(userId: string | null) {
  syncOwnProfileContentCacheUser(userId);
  if (!userId) return;
  ownProfileContentCacheVersion += 1;
  ownProfileContentCache = null;
}
