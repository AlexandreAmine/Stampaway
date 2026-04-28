
-- De-duplicate existing usernames (case-insensitive) by suffixing newer ones with a short id fragment
UPDATE public.profiles
SET username = username || '_' || substr(user_id::text, 1, 4)
WHERE user_id IN (
  SELECT user_id FROM (
    SELECT user_id,
           row_number() OVER (PARTITION BY lower(username) ORDER BY created_at) AS rn
    FROM public.profiles
  ) t WHERE rn > 1
);

-- Enforce case-insensitive uniqueness on username
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username));

-- Public RPC to check availability without exposing the profiles list
CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(trim(_username))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon, authenticated;

-- Update handle_new_user to fail clearly if metadata username is taken (signup picks unique)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  desired_username text;
BEGIN
  desired_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(COALESCE(NEW.email, ''), '@', 1));

  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(trim(desired_username))) THEN
    RAISE EXCEPTION 'username_taken' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.profiles (user_id, username, email, phone, date_of_birth)
  VALUES (
    NEW.id,
    desired_username,
    NEW.email,
    NEW.phone,
    CASE
      WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'date_of_birth')::date
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;
