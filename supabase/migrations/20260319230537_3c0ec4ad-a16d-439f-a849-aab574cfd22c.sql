
ALTER TABLE public.reviews 
  ADD COLUMN IF NOT EXISTS visit_year integer,
  ADD COLUMN IF NOT EXISTS visit_month integer,
  ADD COLUMN IF NOT EXISTS duration_days integer;
