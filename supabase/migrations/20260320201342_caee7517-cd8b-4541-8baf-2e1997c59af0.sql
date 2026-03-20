
-- Review likes table
CREATE TABLE public.review_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, review_id)
);

ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Review likes viewable by everyone" ON public.review_likes FOR SELECT USING (true);
CREATE POLICY "Users can like reviews" ON public.review_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike reviews" ON public.review_likes FOR DELETE USING (auth.uid() = user_id);

-- List likes table
CREATE TABLE public.list_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, list_id)
);

ALTER TABLE public.list_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "List likes viewable by everyone" ON public.list_likes FOR SELECT USING (true);
CREATE POLICY "Users can like lists" ON public.list_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike lists" ON public.list_likes FOR DELETE USING (auth.uid() = user_id);
