import { supabase } from "@/integrations/supabase/client";

// ============= Module-level caches =============
// These caches persist for the lifetime of the page session AND are mirrored
// to localStorage, so a cold app start renders Explore/Search instantly from
// the last known rankings (stale-while-revalidate: anything older than the
// fresh TTL is served immediately and refreshed in the background).
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes ("fresh" — no refetch at all)
const STALE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // persisted data older than this is discarded
const STORAGE_KEY = "stampaway_rankings_cache_v1";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const visitorCountCache: { current: CacheEntry<Map<string, number>> | null } = { current: null };
const monthlyVisitorCountCache: { current: CacheEntry<Map<string, number>> | null } = { current: null };
const avgRatingCache: { current: CacheEntry<Map<string, number>> | null } = { current: null };
const placesCache: { current: CacheEntry<any[]> | null } = { current: null };
const categoryCache = new Map<string, CacheEntry<Map<string, number>>>();

// ---- localStorage persistence -------------------------------------------
type PersistedMapEntry = { data: [string, number][]; ts: number };
type PersistedShape = {
  visitorCount?: PersistedMapEntry;
  monthlyVisitor?: PersistedMapEntry;
  avgRating?: PersistedMapEntry;
  places?: { data: any[]; ts: number };
  categories?: Record<string, PersistedMapEntry>;
};

try {
  const stored: PersistedShape = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  const now = Date.now();
  const usable = (e?: { ts: number }) => !!e && now - e.ts <= STALE_MAX_AGE_MS;
  const toMapEntry = (e: PersistedMapEntry): CacheEntry<Map<string, number>> => ({
    data: new Map(e.data),
    ts: e.ts,
  });
  if (usable(stored.visitorCount)) visitorCountCache.current = toMapEntry(stored.visitorCount!);
  if (usable(stored.monthlyVisitor)) monthlyVisitorCountCache.current = toMapEntry(stored.monthlyVisitor!);
  if (usable(stored.avgRating)) avgRatingCache.current = toMapEntry(stored.avgRating!);
  if (usable(stored.places) && Array.isArray(stored.places!.data)) {
    placesCache.current = { data: stored.places!.data, ts: stored.places!.ts };
  }
  Object.entries(stored.categories || {}).forEach(([category, entry]) => {
    if (usable(entry)) categoryCache.set(category, toMapEntry(entry));
  });
} catch {}

let persistTimer: number | null = null;
function schedulePersist() {
  if (typeof window === "undefined" || persistTimer !== null) return;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    try {
      const fromMapEntry = (e: CacheEntry<Map<string, number>> | null): PersistedMapEntry | undefined =>
        e ? { data: [...e.data.entries()], ts: e.ts } : undefined;
      const shape: PersistedShape = {
        visitorCount: fromMapEntry(visitorCountCache.current),
        monthlyVisitor: fromMapEntry(monthlyVisitorCountCache.current),
        avgRating: fromMapEntry(avgRatingCache.current),
        places: placesCache.current
          ? { data: placesCache.current.data, ts: placesCache.current.ts }
          : undefined,
        categories: Object.fromEntries(
          [...categoryCache.entries()].map(([category, entry]) => [
            category,
            { data: [...entry.data.entries()], ts: entry.ts },
          ])
        ),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shape));
    } catch {}
  }, 1000);
}
// --------------------------------------------------------------------------

// In-flight promise dedup so concurrent callers share one network request.
const inflight = new Map<string, Promise<any>>();

function isFresh<T>(entry: CacheEntry<T> | null): boolean {
  return entry !== null && Date.now() - entry.ts < CACHE_TTL_MS;
}

function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inflight.has(key)) return inflight.get(key)!;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function refreshWithStaleFallback<T>(
  getStaleEntry: () => CacheEntry<T> | null | undefined,
  refresh: () => Promise<T>
): Promise<T> {
  try {
    return await refresh();
  } catch (error) {
    const staleEntry = getStaleEntry();
    if (staleEntry) {
      return staleEntry.data;
    }
    throw error;
  }
}

/**
 * Fresh entry: return it. Stale entry: return it immediately and refresh in
 * the background (stale-while-revalidate). No entry: fetch and wait.
 */
async function cachedFetch<T>(
  key: string,
  cacheRef: { current: CacheEntry<T> | null },
  refresh: () => Promise<T>
): Promise<T> {
  const entry = cacheRef.current;
  if (entry && isFresh(entry)) return entry.data;

  const doRefresh = () =>
    refreshWithStaleFallback(() => cacheRef.current, async () => {
      const data = await refresh();
      cacheRef.current = { data, ts: Date.now() };
      schedulePersist();
      return data;
    });

  if (entry) {
    void dedup(key, doRefresh).catch(() => {});
    return entry.data;
  }
  return dedup(key, doRefresh);
}

/** Clear all rankings caches (call after logging a new review etc.) */
export function clearRankingsCache() {
  visitorCountCache.current = null;
  monthlyVisitorCountCache.current = null;
  avgRatingCache.current = null;
  placesCache.current = null;
  categoryCache.clear();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/** Map<place_id, distinct_visitor_count> — all time */
export async function fetchAllTimeVisitorCountMap(): Promise<Map<string, number>> {
  return cachedFetch("visitorCount", visitorCountCache, async () => {
    const { data, error } = await supabase.rpc("get_place_visitor_counts");
    if (error) throw error;

    return new Map<string, number>(
      (data || []).map((c: any) => [c.place_id, Number(c.visitor_count)])
    );
  });
}

/** Map<place_id, distinct_visitor_count> — current month only */
export async function fetchMonthlyVisitorCountMap(): Promise<Map<string, number>> {
  return cachedFetch("monthlyVisitor", monthlyVisitorCountCache, async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Aggregated server-side; previously this downloaded every review row
    // created this month and counted distinct users on the device.
    const { data, error } = await supabase.rpc("get_place_monthly_visitor_counts", {
      _since: startOfMonth,
    });
    if (error) throw error;

    return new Map<string, number>(
      (data || []).map((c: any) => [c.place_id, Number(c.visitor_count)])
    );
  });
}

/** Map<place_id, average_rating> — all time (server-aggregated) */
export async function fetchAverageRatingMap(): Promise<Map<string, number>> {
  return cachedFetch("avgRating", avgRatingCache, async () => {
    const { data, error } = await supabase.rpc("get_place_avg_ratings");
    if (error) throw error;

    const result = new Map<string, number>();
    (data || []).forEach((row: any) => {
      if (row.avg_rating == null) return;
      result.set(row.place_id, Number(row.avg_rating));
    });
    return result;
  });
}

/**
 * Map<place_id, category_average_rating> for a given sub-rating category.
 * Optionally restricted to a list of place IDs. The per-place average is
 * independent of the scoping, so the scoped variant just filters the full
 * (cached) map.
 */
export async function fetchCategoryAverageMap(
  category: string,
  placeIds?: string[]
): Promise<Map<string, number>> {
  const maps = await fetchCategoryAverageMaps([category]);
  const full = maps.get(category) ?? new Map<string, number>();
  if (!placeIds) return full;

  const scoped = new Map<string, number>();
  placeIds.forEach((id) => {
    const value = full.get(id);
    if (value !== undefined) scoped.set(id, value);
  });
  return scoped;
}

export async function fetchCategoryAverageMaps(
  categories: string[]
): Promise<Map<string, Map<string, number>>> {
  const result = new Map<string, Map<string, number>>();
  const missingCategories: string[] = [];
  const staleCategories: string[] = [];

  categories.forEach((category) => {
    const cached = categoryCache.get(category);
    if (isFresh(cached || null)) {
      result.set(category, cached!.data);
      return;
    }

    if (cached) {
      // Stale-while-revalidate: serve the (possibly persisted) stale map now;
      // it is refreshed in the background below.
      result.set(category, cached.data);
      if (!staleCategories.includes(category)) staleCategories.push(category);
      return;
    }

    if (!missingCategories.includes(category)) {
      missingCategories.push(category);
    }
  });

  if (staleCategories.length > 0) {
    const staleKey = `cats:${[...staleCategories].sort().join("|")}`;
    void dedup(staleKey, async () => {
      const { data, error } = await supabase.rpc("get_place_category_averages", {
        _categories: staleCategories,
      });
      if (error) throw error;

      const maps = new Map<string, Map<string, number>>();
      staleCategories.forEach((category) => maps.set(category, new Map<string, number>()));
      (data || []).forEach((row: any) => {
        if (row.avg_rating == null) return;
        maps.get(row.category)?.set(row.place_id, Number(row.avg_rating));
      });
      maps.forEach((map, category) => {
        categoryCache.set(category, { data: map, ts: Date.now() });
      });
      schedulePersist();
    }).catch(() => {});
  }

  if (missingCategories.length === 0) return result;

  const staleEntries = new Map(
    missingCategories.map((category) => [category, categoryCache.get(category)])
  );
  const cacheKey = `cats:${[...missingCategories].sort().join("|")}`;
  let fetchedMaps: Map<string, Map<string, number>>;
  try {
    fetchedMaps = await dedup(cacheKey, async () => {
      const maps = new Map<string, Map<string, number>>();
      missingCategories.forEach((category) => maps.set(category, new Map<string, number>()));

      // Aggregated server-side; previously this downloaded every review id
      // plus all matching sub-ratings in sequential 500-id chunks.
      const { data, error } = await supabase.rpc("get_place_category_averages", {
        _categories: missingCategories,
      });
      if (error) throw error;

      (data || []).forEach((row: any) => {
        if (row.avg_rating == null) return;
        maps.get(row.category)?.set(row.place_id, Number(row.avg_rating));
      });

      return maps;
    });
  } catch (error) {
    const hasCompleteFallback = missingCategories.every(
      (category) => staleEntries.get(category) !== undefined
    );
    if (!hasCompleteFallback) throw error;

    missingCategories.forEach((category) => {
      result.set(category, staleEntries.get(category)!.data);
    });
    return result;
  }

  missingCategories.forEach((category) => {
    const map = fetchedMaps.get(category);
    if (!map) return;

    categoryCache.set(category, { data: map, ts: Date.now() });
    result.set(category, map);
  });
  schedulePersist();

  return result;
}

/** Fetch ALL places (paginated) */
export async function fetchAllPlaces(): Promise<any[]> {
  return cachedFetch("allPlaces", placesCache, async () => {
    const PAGE = 1000;
    let all: any[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("places")
        .select("id, name, country, type, image")
        .range(offset, offset + PAGE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      all = all.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    return all;
  });
}
