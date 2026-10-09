-- Category ratings of one destination (the "Categories" screen of a place),
-- computed on the server. The app used to download every review of the
-- place and all their category ratings to average them on the phone: slow
-- for popular places, and past 1,000 rows the results were cut short.
--
-- SECURITY INVOKER (the default): row-level security applies exactly as it
-- did to the app's own queries, so the numbers are the same as before.
-- Until this is applied, the app falls back to the old calculation.

CREATE OR REPLACE FUNCTION public.get_place_category_stats(_place_id uuid)
RETURNS TABLE(category text, avg_rating numeric, rating_count bigint)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT sr.category, AVG(sr.rating) AS avg_rating, COUNT(*) AS rating_count
  FROM public.review_sub_ratings sr
  JOIN public.reviews r ON r.id = sr.review_id
  WHERE r.place_id = _place_id
  GROUP BY sr.category
$$;

GRANT EXECUTE ON FUNCTION public.get_place_category_stats(uuid) TO authenticated;
