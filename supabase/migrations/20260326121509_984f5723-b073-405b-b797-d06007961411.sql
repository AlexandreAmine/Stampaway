INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pictures', 'profile-pictures', true);

CREATE POLICY "Users can upload their profile picture"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their profile picture"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their profile picture"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Profile pictures are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');