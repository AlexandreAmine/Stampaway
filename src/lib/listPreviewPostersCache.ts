import { supabase } from "@/integrations/supabase/client";

// 10 minutes: local edits invalidate explicitly (invalidateListPreviewPostersCache),
// so the TTL only bounds staleness from *other* devices. The previous 60s TTL
// caused constant refetching while browsing lists in one session.
export const LIST_PREVIEW_POSTERS_CACHE_TTL_MS = 10 * 60 * 1000;

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

  const request = loadPreviewItems(listId, maxItems)
    .then((items) => {
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

// ---- batched loading ----------------------------------------------------
// A screen of lists (Search shows up to 30, Explore ~20) used to send one
// request per list. Every preview asked for in the same tick — all the rows
// of one render — now shares a single request: lists with their first
// `maxItems` items embedded (PostgREST applies the limit per list).
// Anything the batch doesn't return, or a failed batch, falls back to the
// original per-list query, so results never differ from before.

type BatchWaiter = {
  resolve: (items: ListPreviewPosterPlace[]) => void;
  reject: (error: unknown) => void;
};

const BATCH_CHUNK_SIZE = 50;
const pendingBatches = new Map<number, Map<string, BatchWaiter[]>>();

function loadPreviewItems(listId: string, maxItems: number): Promise<ListPreviewPosterPlace[]> {
  return new Promise((resolve, reject) => {
    let batch = pendingBatches.get(maxItems);
    if (!batch) {
      batch = new Map();
      pendingBatches.set(maxItems, batch);
      queueMicrotask(() => {
        pendingBatches.delete(maxItems);
        void flushBatch(maxItems, batch!);
      });
    }
    const waiters = batch.get(listId) ?? [];
    waiters.push({ resolve, reject });
    batch.set(listId, waiters);
  });
}

async function flushBatch(maxItems: number, batch: Map<string, BatchWaiter[]>) {
  const listIds = [...batch.keys()];
  const found = new Map<string, ListPreviewPosterPlace[]>();

  if (listIds.length > 1) {
    const chunks: string[][] = [];
    for (let i = 0; i < listIds.length; i += BATCH_CHUNK_SIZE) {
      chunks.push(listIds.slice(i, i + BATCH_CHUNK_SIZE));
    }
    await Promise.all(
      chunks.map(async (ids) => {
        try {
          const { data, error } = await supabase
            .from("lists")
            .select("id, list_items(position, places!inner(id, name, country, type, image))")
            .in("id", ids)
            .order("position", { referencedTable: "list_items", ascending: true })
            .limit(maxItems, { referencedTable: "list_items" });
          if (error) throw error;
          (data || []).forEach((row: any) => {
            found.set(
              row.id,
              (row.list_items || []).map((i: any) => i.places as ListPreviewPosterPlace)
            );
          });
        } catch (error) {
          console.error("Batched list preview fetch failed, loading lists one by one:", error);
        }
      })
    );
  }

  listIds.forEach((id) => {
    const waiters = batch.get(id)!;
    const items = found.get(id);
    const result = items ? Promise.resolve(items) : fetchPreviewItemsSingle(id, maxItems);
    result.then(
      (value) => waiters.forEach((w) => w.resolve(value)),
      (error) => waiters.forEach((w) => w.reject(error))
    );
  });
}

async function fetchPreviewItemsSingle(listId: string, maxItems: number) {
  const { data, error } = await supabase
    .from("list_items")
    .select("id, position, places!inner(id, name, country, type, image)")
    .eq("list_id", listId)
    .order("position", { ascending: true })
    .limit(maxItems);
  if (error) throw error;
  return (data || []).map((i: any) => i.places as ListPreviewPosterPlace);
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
