-- Checkpoint 5c: server-side aggregation for the remaining client-side
-- whole-table downloads, plus a trigram index for username search.
-- All functions replicate existing client math exactly (no behavior change).

-- ---------------------------------------------------------------------------
-- 1) Top liked reviews / lists (Explore "popular" sections).
--    Previously the client downloaded every review_likes / list_likes row
--    and counted them on the device.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_top_liked_reviews(_limit integer DEFAULT 10)
RETURNS TABLE(review_id uuid, like_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT review_id, count(*) AS like_count
  FROM public.review_likes
  GROUP BY review_id
  ORDER BY count(*) DESC
  LIMIT _limit
$$;

CREATE OR REPLACE FUNCTION public.get_top_liked_lists(_limit integer DEFAULT 10)
RETURNS TABLE(list_id uuid, like_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT list_id, count(*) AS like_count
  FROM public.list_likes
  GROUP BY list_id
  ORDER BY count(*) DESC
  LIMIT _limit
$$;

-- ---------------------------------------------------------------------------
-- 2) Place stats. Previously the client downloaded every review row of a
--    place to compute these. Replicates src/lib/reviewDedup.ts exactly:
--    one review per user, keeping the one with the newest visit date
--    (rows with a visit_year win over rows without; then visit_year DESC,
--    visit_month DESC with null as 0, then created_at DESC).
--    written_reviews_count is over ALL rows (not deduped), matching the
--    client. Distribution bucket = round(rating * 2) - 1 into 10 buckets.
--    avg_rating is returned unrounded; the client keeps its own rounding.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_place_stats(_place_id uuid)
RETURNS TABLE(
  visitors_count bigint,
  written_reviews_count bigint,
  ratings_count bigint,
  avg_rating numeric,
  distribution bigint[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH deduped AS (
    SELECT DISTINCT ON (user_id) user_id, rating
    FROM public.reviews
    WHERE place_id = _place_id
    ORDER BY user_id,
      (visit_year IS NULL) ASC,
      visit_year DESC,
      COALESCE(visit_month, 0) DESC,
      created_at DESC
  )
  SELECT
    (SELECT count(*) FROM deduped) AS visitors_count,
    (SELECT count(*) FROM public.reviews
      WHERE place_id = _place_id
        AND review_text IS NOT NULL
        AND btrim(review_text) <> '') AS written_reviews_count,
    (SELECT count(*) FROM deduped WHERE rating IS NOT NULL) AS ratings_count,
    (SELECT avg(rating) FROM deduped WHERE rating IS NOT NULL) AS avg_rating,
    (SELECT array_agg(cnt ORDER BY idx) FROM (
      SELECT b.idx, count(d.user_id) AS cnt
      FROM generate_series(0, 9) AS b(idx)
      LEFT JOIN deduped d
        ON d.rating IS NOT NULL
       AND round(d.rating * 2)::int - 1 = b.idx
      GROUP BY b.idx
    ) buckets) AS distribution
$$;

-- ---------------------------------------------------------------------------
-- 3) Unread notification counts for the Home badge. Previously the client
--    downloaded all of its own review ids and list ids and sent them back
--    in .in() filters. auth.uid() scopes everything to the caller.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_unread_notification_counts(_since timestamptz)
RETURNS TABLE(
  followers_count bigint,
  requests_count bigint,
  review_likes_count bigint,
  list_likes_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*) FROM public.followers
      WHERE following_id = auth.uid() AND created_at > _since) AS followers_count,
    (SELECT count(*) FROM public.follow_requests
      WHERE target_id = auth.uid() AND created_at > _since) AS requests_count,
    (SELECT count(*) FROM public.review_likes rl
      JOIN public.reviews r ON r.id = rl.review_id
      WHERE r.user_id = auth.uid()
        AND rl.user_id <> auth.uid()
        AND rl.created_at > _since) AS review_likes_count,
    (SELECT count(*) FROM public.list_likes ll
      JOIN public.lists l ON l.id = ll.list_id
      WHERE l.user_id = auth.uid()
        AND ll.user_id <> auth.uid()
        AND ll.created_at > _since) AS list_likes_count
$$;

-- ---------------------------------------------------------------------------
-- 4) Trigram index so username search (ilike '%q%') can use an index scan.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
  ON public.profiles USING gin (username gin_trgm_ops);
