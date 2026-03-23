ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT null;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text DEFAULT null;