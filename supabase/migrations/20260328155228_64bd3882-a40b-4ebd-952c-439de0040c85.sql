
CREATE TABLE public.review_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  tagged_user_id uuid NOT NULL,
  tagged_by_user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(review_id, tagged_user_id)
);

ALTER TABLE public.review_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Review tags viewable by everyone" ON public.review_tags FOR SELECT USING (true);
CREATE POLICY "Users can tag in their own reviews" ON public.review_tags FOR INSERT WITH CHECK (auth.uid() = tagged_by_user_id);
CREATE POLICY "Users can remove tags from their own reviews" ON public.review_tags FOR DELETE USING (auth.uid() = tagged_by_user_id);
