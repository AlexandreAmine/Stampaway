CREATE TABLE public.country_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_name text NOT NULL UNIQUE,
  facts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.country_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Country facts viewable by everyone" ON public.country_facts
  FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can insert country facts" ON public.country_facts
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update country facts" ON public.country_facts
  FOR UPDATE TO public USING (true) WITH CHECK (true);