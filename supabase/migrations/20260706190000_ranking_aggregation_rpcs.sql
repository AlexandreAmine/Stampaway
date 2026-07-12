-- Server-side aggregation RPCs for Explore rankings.
--
-- Replaces client-side aggregation that previously downloaded the entire
-- reviews table (and all matching review_sub_ratings) to the device.
-- Each function replicates the exact math the client performed:
--   * avg rating       = AVG(rating) per place over ALL reviews with a rating
--                        (no per-user dedup — matches fetchAverageRatingMap)
--   * monthly visitors = COUNT(DISTINCT user_id) per place with
--                        created_at >= a caller-supplied start-of-month
--                        (client passes its local-timezone month start,
--                        matching the previous client computation)
--   * category average = AVG(review_sub_ratings.rating) per (place, category)
--                        joined through reviews (no per-user dedup)
--
-- Style matches existing get_place_visitor_counts: sql, STABLE,
-- SECURITY DEFINER, search_path pinned to public. All underlying rows are
-- world-readable under current RLS, so these expose no new data.

CREATE OR REPLACE FUNCTION public.get_place_avg_ratings()
RETURNS TABLE(place_id uuid, avg_rating numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT place_id, AVG(rating) AS avg_rating
  FROM public.reviews
  WHERE rating IS NOT NULL
  GROUP BY place_id
$$;

CREATE OR REPLACE FUNCTION public.get_place_monthly_visitor_counts(_since timestamptz)
RETURNS TABLE(place_id uuid, visitor_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT place_id, COUNT(DISTINCT user_id) AS visitor_count
  FROM public.reviews
  WHERE created_at >= _since
  GROUP BY place_id
$$;

CREATE OR REPLACE FUNCTION public.get_place_category_averages(_categories text[])
RETURNS TABLE(place_id uuid, category text, avg_rating numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.place_id, sr.category, AVG(sr.rating) AS avg_rating
  FROM public.review_sub_ratings sr
  JOIN public.reviews r ON r.id = sr.review_id
  WHERE sr.category = ANY(_categories)
  GROUP BY r.place_id, sr.category
$$;
