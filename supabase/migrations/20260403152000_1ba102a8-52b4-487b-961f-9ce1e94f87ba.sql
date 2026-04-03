CREATE TABLE public.city_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name text NOT NULL,
  country_name text NOT NULL,
  facts jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(city_name, country_name)
);

ALTER TABLE public.city_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "City facts viewable by everyone" ON public.city_facts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert city facts" ON public.city_facts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update city facts" ON public.city_facts FOR UPDATE USING (true) WITH CHECK (true);