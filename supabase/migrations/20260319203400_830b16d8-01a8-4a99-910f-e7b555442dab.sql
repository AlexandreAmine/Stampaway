
CREATE TABLE public.favorite_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  slot_index integer NOT NULL CHECK (slot_index >= 0 AND slot_index <= 3),
  type text NOT NULL CHECK (type IN ('city', 'country')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slot_index, type)
);

ALTER TABLE public.favorite_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Favorites are viewable by everyone" ON public.favorite_places FOR SELECT USING (true);
CREATE POLICY "Users can manage their own favorites" ON public.favorite_places FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own favorites" ON public.favorite_places FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own favorites" ON public.favorite_places FOR DELETE USING (auth.uid() = user_id);
