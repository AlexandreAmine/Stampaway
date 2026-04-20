import { supabase } from "@/integrations/supabase/client";

// ============= Module-level caches =============
// These caches persist for the lifetime of the page session, so navigating
// between Search / Explore / Profile tabs reuses results instead of refetching.
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const visitorCountCache: { current: CacheEntry<Map<string, number>> | null } = { current: null };
const monthlyVisitorCountCache: { current: CacheEntry<Map<string, number>> | null } = { current: null };
const avgRatingCache: { current: CacheEntry<Map<string, number>> | null } = { current: null };
const placesCache: { current: CacheEntry<any[]> | null } = { current: null };
const categoryCache = new Map<string, CacheEntry<Map<string, number>>>();

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

/** Clear all rankings caches (call after logging a new review etc.) */
export function clearRankingsCache() {
  visitorCountCache.current = null;
  monthlyVisitorCountCache.current = null;
  avgRatingCache.current = null;
  placesCache.current = null;
  categoryCache.clear();
}

/**
 * Fetch ALL reviews in paginated batches to bypass Supabase's 1000-row default limit.
 */
async function fetchAllReviews(columns: string): Promise<any[]> {
  const PAGE = 1000;
  let all: any[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("reviews")
      .select(columns)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

/** Map<place_id, distinct_visitor_count> — all time */
export async function fetchAllTimeVisitorCountMap(): Promise<Map<string, number>> {
  if (isFresh(visitorCountCache.current)) return visitorCountCache.current!.data;
  return dedup("visitorCount", async () => {
    const { data } = await supabase.rpc("get_place_visitor_counts");
    const map = new Map<string, number>((data || []).map((c: any) => [c.place_id, Number(c.visitor_count)]));
    visitorCountCache.current = { data: map, ts: Date.now() };
    return map;
  });
}

/** Map<place_id, distinct_visitor_count> — current month only */
export async function fetchMonthlyVisitorCountMap(): Promise<Map<string, number>> {
  if (isFresh(monthlyVisitorCountCache.current)) return monthlyVisitorCountCache.current!.data;
  return dedup("monthlyVisitor", async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Paginated fetch for this month's reviews
  const PAGE = 1000;
  let allMonthReviews: any[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("reviews")
      .select("place_id, user_id")
      .gte("created_at", startOfMonth)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    allMonthReviews = allMonthReviews.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  // Count DISTINCT user_id per place_id
  const placeUsers = new Map<string, Set<string>>();
  allMonthReviews.forEach((r) => {
    if (!placeUsers.has(r.place_id)) placeUsers.set(r.place_id, new Set());
    placeUsers.get(r.place_id)!.add(r.user_id);
  });

  const result = new Map<string, number>();
  placeUsers.forEach((users, placeId) => result.set(placeId, users.size));
    monthlyVisitorCountCache.current = { data: result, ts: Date.now() };
  return result;
  });
}

/** Map<place_id, average_rating> — all time, using paginated fetch */
export async function fetchAverageRatingMap(): Promise<Map<string, number>> {
  if (isFresh(avgRatingCache.current)) return avgRatingCache.current!.data;
  return dedup("avgRating", async () => {
  const allRatings = await fetchAllReviews("place_id, rating");
  const agg = new Map<string, { total: number; count: number }>();
  allRatings.forEach((r: any) => {
    if (r.rating == null) return;
    const cur = agg.get(r.place_id) || { total: 0, count: 0 };
    cur.total += Number(r.rating);
    cur.count += 1;
    agg.set(r.place_id, cur);
  });
  const result = new Map<string, number>();
  agg.forEach((v, k) => result.set(k, v.total / v.count));
    avgRatingCache.current = { data: result, ts: Date.now() };
  return result;
  });
}

/**
 * Map<place_id, category_average_rating> for a given sub-rating category.
 * Optionally restricted to a list of place IDs. Paginated to avoid Supabase's
 * 1000-row limit on `.in()` filters and result sets.
 */
export async function fetchCategoryAverageMap(
  category: string,
  placeIds?: string[]
): Promise<Map<string, number>> {
  // Cache only the unscoped (full) category map; scoped variants are cheap and rare.
  if (!placeIds) {
    const cached = categoryCache.get(category);
    if (isFresh(cached || null)) return cached!.data;
    return dedup(`cat:${category}`, async () => {
      const result = await computeCategoryAverageMap(category, undefined);
      categoryCache.set(category, { data: result, ts: Date.now() });
      return result;
    });
  }
  return computeCategoryAverageMap(category, placeIds);
}

async function computeCategoryAverageMap(
  category: string,
  placeIds?: string[]
): Promise<Map<string, number>> {
  // 1. Fetch reviews (id, place_id), optionally filtered to placeIds in chunks of 500
  const allReviews: { id: string; place_id: string }[] = [];
  if (placeIds && placeIds.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < placeIds.length; i += CHUNK) {
      const slice = placeIds.slice(i, i + CHUNK);
      // Paginate within each chunk
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data } = await supabase
          .from("reviews")
          .select("id, place_id")
          .in("place_id", slice)
          .range(offset, offset + PAGE - 1);
        if (!data || data.length === 0) break;
        allReviews.push(...(data as any));
        if (data.length < PAGE) break;
        offset += PAGE;
      }
    }
  } else {
    const reviews = await fetchAllReviews("id, place_id");
    allReviews.push(...(reviews as any));
  }

  if (allReviews.length === 0) return new Map();

  const reviewPlaceMap = new Map(allReviews.map((r) => [r.id, r.place_id]));
  const reviewIds = allReviews.map((r) => r.id);

  // 2. Fetch matching sub-ratings for the chosen category — chunk reviewIds
  const catMap: Record<string, { sum: number; count: number }> = {};
  const ID_CHUNK = 500;
  for (let i = 0; i < reviewIds.length; i += ID_CHUNK) {
    const slice = reviewIds.slice(i, i + ID_CHUNK);
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await supabase
        .from("review_sub_ratings")
        .select("review_id, rating")
        .eq("category", category)
        .in("review_id", slice)
        .range(offset, offset + PAGE - 1);
      if (!data || data.length === 0) break;
      data.forEach((sr: any) => {
        const pid = reviewPlaceMap.get(sr.review_id);
        if (!pid) return;
        if (!catMap[pid]) catMap[pid] = { sum: 0, count: 0 };
        catMap[pid].sum += Number(sr.rating);
        catMap[pid].count += 1;
      });
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }

  const result = new Map<string, number>();
  Object.entries(catMap).forEach(([pid, v]) => result.set(pid, v.sum / v.count));
  return result;
}

/** Fetch ALL places (paginated) */
export async function fetchAllPlaces(): Promise<any[]> {
  if (isFresh(placesCache.current)) return placesCache.current!.data;
  return dedup("allPlaces", async () => {
  const PAGE = 1000;
  let all: any[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("places")
      .select("id, name, country, type, image")
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
    placesCache.current = { data: all, ts: Date.now() };
  return all;
  });
}
