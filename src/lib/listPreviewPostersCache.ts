import { supabase } from "@/integrations/supabase/client";

export const LIST_PREVIEW_POSTERS_CACHE_TTL_MS = 60_000;

export type ListPreviewPosterPlace = {
  id: string;
  name: string;
  country: string;
  type: string;
  image: string | null;
};

type CacheEntry = {
  items: ListPreviewPosterPlace[];
  cachedAt: number;
};

type RequestToken = {
  userId: string | null;
  globalVersion: number;
  listVersion: number;
};

type Listener = (version: number) => void;

const previewCache = new Map<string, CacheEntry>();
const previewInflight = new Map<string, Promise<ListPreviewPosterPlace[]>>();
const listVersions = new Map<string, number>();
const listeners = new Map<string, Set<Listener>>();

let previewCacheUserId: string | null = null;
let globalVersion = 0;
let notificationVersion = 0;

const getListVersion = (listId: string) => listVersions.get(listId) ?? 0;
const getCacheKey = (userId: string | null, listId: string, maxItems: number) =>
  `${userId ?? "anonymous"}:${listId}:${maxItems}`;
const getCacheKeyPrefix = (userId: string | null, listId: string) =>
  `${userId ?? "anonymous"}:${listId}:`;

function notifyListPreviewPosters(listId: string) {
  notificationVersion += 1;
  listeners.get(listId)?.forEach((listener) => listener(notificationVersion));
}

function notifyAllListPreviewPosters() {
  notificationVersion += 1;
  listeners.forEach((listListeners) => {
    listListeners.forEach((listener) => listener(notificationVersion));
  });
}

export function subscribeListPreviewPostersCache(listId: string, listener: Listener) {
  const listListeners = listeners.get(listId) ?? new Set<Listener>();
  listListeners.add(listener);
  listeners.set(listId, listListeners);

  return () => {
    const current = listeners.get(listId);
    if (!current) return;

    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(listId);
    }
  };
}

export function syncListPreviewPostersCacheUser(userId: string | null) {
  if (previewCacheUserId === userId) return;

  previewCacheUserId = userId;
  globalVersion += 1;
  listVersions.clear();
  previewCache.clear();
  previewInflight.clear();
  notifyAllListPreviewPosters();
}

export function getListPreviewPostersRequestToken(
  userId: string | null,
  listId: string
): RequestToken {
  syncListPreviewPostersCacheUser(userId);

  return {
    userId,
    globalVersion,
    listVersion: getListVersion(listId),
  };
}

export function isListPreviewPostersRequestTokenCurrent(
  userId: string | null,
  listId: string,
  token: RequestToken
) {
  return (
    token.userId === userId &&
    token.userId === previewCacheUserId &&
    token.globalVersion === globalVersion &&
    token.listVersion === getListVersion(listId)
  );
}

export function getCachedListPreviewPosters(
  userId: string | null,
  listId: string,
  maxItems: number
): ListPreviewPosterPlace[] | null {
  syncListPreviewPostersCacheUser(userId);

  const cacheKey = getCacheKey(userId, listId, maxItems);
  const cached = previewCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.cachedAt > LIST_PREVIEW_POSTERS_CACHE_TTL_MS) {
    previewCache.delete(cacheKey);
    return null;
  }

  return cached.items;
}

export function fetchListPreviewPosters(
  userId: string | null,
  listId: string,
  maxItems: number,
  token: RequestToken
): Promise<ListPreviewPosterPlace[]> {
  syncListPreviewPostersCacheUser(userId);

  const cacheKey = getCacheKey(userId, listId, maxItems);
  const cached = getCachedListPreviewPosters(userId, listId, maxItems);
  if (cached) return Promise.resolve(cached);

  const inflight = previewInflight.get(cacheKey);
  if (inflight) return inflight;

  const request = supabase
    .from("list_items")
    .select("id, position, places!inner(id, name, country, type, image)")
    .eq("list_id", listId)
    .order("position", { ascending: true })
    .limit(maxItems)
    .then(({ data, error }) => {
      if (error) throw error;

      const items = (data || []).map((i: any) => i.places as ListPreviewPosterPlace);

      if (isListPreviewPostersRequestTokenCurrent(userId, listId, token)) {
        previewCache.set(cacheKey, {
          items,
          cachedAt: Date.now(),
        });
      }

      return items;
    })
    .finally(() => {
      if (previewInflight.get(cacheKey) === request) {
        previewInflight.delete(cacheKey);
      }
    });

  previewInflight.set(cacheKey, request);
  return request;
}

export function invalidateListPreviewPostersCache(listId?: string | null) {
  if (!listId) {
    globalVersion += 1;
    listVersions.clear();
    previewCache.clear();
    previewInflight.clear();
    notifyAllListPreviewPosters();
    return;
  }

  listVersions.set(listId, getListVersion(listId) + 1);

  const keyPrefix = getCacheKeyPrefix(previewCacheUserId, listId);
  for (const key of Array.from(previewCache.keys())) {
    if (key.startsWith(keyPrefix)) previewCache.delete(key);
  }

  for (const key of Array.from(previewInflight.keys())) {
    if (key.startsWith(keyPrefix)) previewInflight.delete(key);
  }

  notifyListPreviewPosters(listId);
}
