import { supabase } from "@/integrations/supabase/client";

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
  const { data } = await supabase.rpc("get_place_visitor_counts");
  return new Map((data || []).map((c: any) => [c.place_id, Number(c.visitor_count)]));
}

/** Map<place_id, distinct_visitor_count> — current month only */
export async function fetchMonthlyVisitorCountMap(): Promise<Map<string, number>> {
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
  return result;
}

/** Map<place_id, average_rating> — all time, using paginated fetch */
export async function fetchAverageRatingMap(): Promise<Map<string, number>> {
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
  return result;
}

/** Fetch ALL places (paginated) */
export async function fetchAllPlaces(): Promise<any[]> {
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
  return all;
}
