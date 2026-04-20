-- Add language column to facts caches so each language gets its own cached version
ALTER TABLE public.city_facts ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.country_facts ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- Drop old unique constraints if they exist (city_name+country_name and country_name)
-- We need to allow same city in multiple languages.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='city_facts_city_name_country_name_key') THEN
    EXECUTE 'ALTER TABLE public.city_facts DROP CONSTRAINT city_facts_city_name_country_name_key';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='country_facts_country_name_key') THEN
    EXECUTE 'ALTER TABLE public.country_facts DROP CONSTRAINT country_facts_country_name_key';
  END IF;
END $$;

-- New unique constraints per language
CREATE UNIQUE INDEX IF NOT EXISTS city_facts_city_country_lang_idx 
  ON public.city_facts (city_name, country_name, language);
CREATE UNIQUE INDEX IF NOT EXISTS country_facts_country_lang_idx 
  ON public.country_facts (country_name, language);