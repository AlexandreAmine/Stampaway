
-- Storage bucket for place posters
INSERT INTO storage.buckets (id, name, public) VALUES ('place-posters', 'place-posters', true);

-- Public read access for poster images
CREATE POLICY "Public read posters" ON storage.objects FOR SELECT USING (bucket_id = 'place-posters');

-- Allow authenticated users to upload posters (for edge functions via service role, this is bypassed anyway)
CREATE POLICY "Auth upload posters" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'place-posters');

-- Allow updating posters
CREATE POLICY "Auth update posters" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'place-posters');

-- Allow updating place images by authenticated users
CREATE POLICY "Authenticated users can update places" ON public.places FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
