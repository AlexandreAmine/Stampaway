CREATE TABLE IF NOT EXISTS public.translations_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_hash TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_hash, target_lang)
);

CREATE INDEX IF NOT EXISTS idx_translations_cache_lookup
  ON public.translations_cache (source_hash, target_lang);

ALTER TABLE public.translations_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Translations cache readable by everyone"
  ON public.translations_cache FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert translations cache"
  ON public.translations_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update translations cache"
  ON public.translations_cache FOR UPDATE
  USING (true) WITH CHECK (true);