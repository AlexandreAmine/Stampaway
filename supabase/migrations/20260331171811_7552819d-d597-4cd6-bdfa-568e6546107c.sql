CREATE POLICY "Users can remove their own followers"
ON public.followers
FOR DELETE
TO authenticated
USING (auth.uid() = following_id);