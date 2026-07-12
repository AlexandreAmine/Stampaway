-- Performance indexes (additive only — no schema, RLS, or behavior changes).
--
-- Each index below matches a hot query path in the app. Columns already
-- covered by an existing index or by the leading column of a UNIQUE
-- constraint are intentionally NOT duplicated:
--   review_likes UNIQUE(user_id, review_id)      -> user_id covered
--   list_likes UNIQUE(user_id, list_id)          -> user_id covered
--   follow_requests UNIQUE(requester_id, target_id) -> requester_id covered
--   favorite_places UNIQUE(user_id, slot_index, type) -> user_id covered
--   wishlists UNIQUE(user_id, place_id)          -> user_id covered
--   list_items UNIQUE(list_id, place_id)         -> list_id covered
--   blocked_users UNIQUE(blocker_id, blocked_id) -> blocker_id covered
--   review_tags UNIQUE(review_id, tagged_user_id) -> review_id covered
--   yearly_goal_places UNIQUE(user_id, year, place_id) -> user_id covered
--   profiles user_id UNIQUE                      -> covered
--   reviews: user_id / place_id / created_at indexes already exist

-- Notification badge + per-review like counts:
-- review_likes filtered by review_id (IN list) and created_at (> last read)
CREATE INDEX IF NOT EXISTS idx_review_likes_review_id_created_at
  ON public.review_likes (review_id, created_at DESC);

-- Notification badge + per-list like counts:
-- list_likes filtered by list_id (IN list) and created_at (> last read)
CREATE INDEX IF NOT EXISTS idx_list_likes_list_id_created_at
  ON public.list_likes (list_id, created_at DESC);

-- Incoming follow requests (badge count + notifications sheet):
-- follow_requests filtered by target_id and created_at
CREATE INDEX IF NOT EXISTS idx_follow_requests_target_id_created_at
  ON public.follow_requests (target_id, created_at DESC);

-- Sub-rating lookups by review (category rankings, place sub-rating displays):
-- review_sub_ratings filtered by review_id (IN list) and category (IN list)
CREATE INDEX IF NOT EXISTS idx_review_sub_ratings_review_id_category
  ON public.review_sub_ratings (review_id, category);

-- Place page / friends-wishlist lookups: wishlists filtered by place_id
CREATE INDEX IF NOT EXISTS idx_wishlists_place_id
  ON public.wishlists (place_id);

-- "Saved in N lists" counts on place pages: list_items filtered by place_id
CREATE INDEX IF NOT EXISTS idx_list_items_place_id
  ON public.list_items (place_id);

-- Reverse block checks (profile views check both directions):
-- blocked_users filtered by blocked_id
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id
  ON public.blocked_users (blocked_id);

-- Comment threads + comment notifications:
-- review_comments filtered by review_id (IN list), ordered/filtered by created_at
CREATE INDEX IF NOT EXISTS idx_review_comments_review_id_created_at
  ON public.review_comments (review_id, created_at DESC);

-- "Your activity" own-comments listing: review_comments filtered by user_id
CREATE INDEX IF NOT EXISTS idx_review_comments_user_id
  ON public.review_comments (user_id);

-- Tags tab: review_tags filtered by tagged_user_id
CREATE INDEX IF NOT EXISTS idx_review_tags_tagged_user_id
  ON public.review_tags (tagged_user_id);
