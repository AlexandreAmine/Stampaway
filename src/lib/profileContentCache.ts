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
  saveLastKnown(userId, data);
}

// The last content shown on the user's own profile, kept on the phone so the
// Profile tab opens with it (after a relaunch, or once the 60 s cache above
// has lapsed or been invalidated) while the fresh copy loads, instead of
// zeros and empty favorites. Only ever shown to the same user, and always
// replaced by the refetch that follows.
const LAST_KNOWN_KEY = "stampaway_own_profile_v1";
let lastKnown: { userId: string; data: unknown } | null | undefined;

// The map data holds Sets, which JSON can't store as they are.
const toJson = (_key: string, value: unknown) => (value instanceof Set ? { __set: [...value] } : value);
const fromJson = (_key: string, value: unknown) =>
  value && typeof value === "object" && Array.isArray((value as { __set?: unknown }).__set)
    ? new Set((value as { __set: unknown[] }).__set)
    : value;

function saveLastKnown(userId: string, data: unknown) {
  lastKnown = { userId, data };
  try {
    localStorage.setItem(LAST_KNOWN_KEY, JSON.stringify(lastKnown, toJson));
  } catch {
    // Storage full or unavailable: the in-memory copy still works.
  }
}

/** The fresh cached content if any, else the last content seen, for this user. */
export function getLastKnownOwnProfileContent<T>(userId: string | null): T | null {
  const fresh = getFreshOwnProfileContentCache<T>(userId);
  if (fresh || !userId) return fresh;
  if (lastKnown === undefined) {
    try {
      lastKnown = JSON.parse(localStorage.getItem(LAST_KNOWN_KEY) || "null", fromJson);
    } catch {
      lastKnown = null;
    }
  }
  return lastKnown?.userId === userId ? (lastKnown.data as T) : null;
}

export function invalidateOwnProfileContentCache(userId: string | null) {
  syncOwnProfileContentCacheUser(userId);
  if (!userId) return;
  ownProfileContentCacheVersion += 1;
  ownProfileContentCache = null;
}
