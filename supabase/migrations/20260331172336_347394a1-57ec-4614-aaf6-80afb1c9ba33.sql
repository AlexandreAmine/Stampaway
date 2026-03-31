CREATE POLICY "Users can accept followers for themselves"
ON public.followers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = following_id);