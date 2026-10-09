import { supabase } from "@/integrations/supabase/client";
import { SUB_CATEGORIES } from "@/lib/subCategories";
import type { SubRating } from "@/lib/reviewDetailQuery";

// PostgREST's answer when a database function doesn't exist.
const FUNCTION_MISSING = "PGRST202";

type CategoryAverage = { category: string; avg: number; count: number };

const roundToTenth = (value: number) => Math.round(value * 10) / 10;

/**
 * Average of each category over all reviews of the place, and the viewer's
 * own category ratings from their latest review of it. The averages come from
 * one server-side summary; until that function is installed on the database,
 * they're computed here from the raw ratings, as before.
 */
export async function fetchPlaceCategoryStats(
  placeId: string,
  userId: string | undefined
): Promise<{ averages: CategoryAverage[]; myRatings: SubRating[] }> {
  const [averages, myRatings] = await Promise.all([
    fetchCategoryAverages(placeId),
    userId ? fetchMyLatestSubRatings(placeId, userId) : Promise.resolve([]),
  ]);
  // No one has rated categories here: nothing of the viewer's to show either.
  return { averages, myRatings: averages.length ? myRatings : [] };
}

async function fetchCategoryAverages(placeId: string): Promise<CategoryAverage[]> {
  const { data, error } = await supabase.rpc("get_place_category_stats", { _place_id: placeId });
  // Anything but "function not installed yet" is a real failure (offline…).
  if (error && error.code !== FUNCTION_MISSING) throw error;
  if (!error) {
    const byCategory = new Map((data || []).map((row) => [row.category, row]));
    return SUB_CATEGORIES.filter((cat) => byCategory.has(cat)).map((cat) => {
      const row = byCategory.get(cat)!;
      return { category: cat, avg: roundToTenth(Number(row.avg_rating)), count: Number(row.rating_count) };
    });
  }

  const { data: reviews } = await supabase.from("reviews").select("id").eq("place_id", placeId);
  if (!reviews || reviews.length === 0) return [];
  const { data: allSubs } = await supabase
    .from("review_sub_ratings")
    .select("category, rating")
    .in("review_id", reviews.map((r) => r.id));
  const catMap = new Map<string, number[]>();
  (allSubs || []).forEach((s) => {
    if (!catMap.has(s.category)) catMap.set(s.category, []);
    catMap.get(s.category)!.push(Number(s.rating));
  });
  return SUB_CATEGORIES.filter((cat) => catMap.has(cat)).map((cat) => {
    const vals = catMap.get(cat)!;
    return { category: cat, avg: roundToTenth(vals.reduce((a, b) => a + b, 0) / vals.length), count: vals.length };
  });
}

async function fetchMyLatestSubRatings(placeId: string, userId: string): Promise<SubRating[]> {
  const { data: latest } = await supabase
    .from("reviews")
    .select("id")
    .eq("place_id", placeId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return [];
  const { data } = await supabase.from("review_sub_ratings").select("category, rating").eq("review_id", latest.id);
  return (data || []) as SubRating[];
}
