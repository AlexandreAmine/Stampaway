CREATE OR REPLACE FUNCTION public.get_place_review_counts()
RETURNS TABLE(place_id uuid, review_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT place_id, count(DISTINCT user_id) as review_count
  FROM public.reviews
  WHERE rating IS NOT NULL
  GROUP BY place_id
$$;