
-- Add is_private to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- Create blocked_users table
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own blocks" ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "Users can block others" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock others" ON public.blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- Create follow_requests table for private accounts
CREATE TABLE public.follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, target_id)
);
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own requests" ON public.follow_requests FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);
CREATE POLICY "Users can create follow requests" ON public.follow_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can delete follow requests" ON public.follow_requests FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Create review_sub_ratings table
CREATE TABLE public.review_sub_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  category text NOT NULL,
  rating numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.review_sub_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sub ratings viewable by everyone" ON public.review_sub_ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert sub ratings for own reviews" ON public.review_sub_ratings FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.reviews WHERE id = review_sub_ratings.review_id AND user_id = auth.uid())
);
CREATE POLICY "Users can update sub ratings for own reviews" ON public.review_sub_ratings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.reviews WHERE id = review_sub_ratings.review_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete sub ratings for own reviews" ON public.review_sub_ratings FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.reviews WHERE id = review_sub_ratings.review_id AND user_id = auth.uid())
);
