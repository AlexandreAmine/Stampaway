CREATE OR REPLACE FUNCTION public.get_place_visitor_counts()
 RETURNS TABLE(place_id uuid, visitor_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT place_id, count(DISTINCT user_id) as visitor_count
  FROM public.reviews
  GROUP BY place_id
$$;