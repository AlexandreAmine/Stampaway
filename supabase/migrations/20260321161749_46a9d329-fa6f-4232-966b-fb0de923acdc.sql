
-- Create review_comments table for comments and replies
CREATE TABLE public.review_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  parent_id UUID REFERENCES public.review_comments(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Comments are viewable by everyone"
  ON public.review_comments FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.review_comments FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.review_comments FOR DELETE TO public
  USING (auth.uid() = user_id);
