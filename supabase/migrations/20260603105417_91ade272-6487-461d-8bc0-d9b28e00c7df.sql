-- Add needs_username flag to profiles for OAuth (Apple) signups who must pick a username
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS needs_username boolean NOT NULL DEFAULT false;

-- Update handle_new_user trigger: when no username was provided in metadata
-- (e.g. Apple sign-in), generate a unique placeholder and flag needs_username=true.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  provided_username text;
  desired_username text;
  needs_pick boolean := false;
BEGIN
  provided_username := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'username', '')), '');

  IF provided_username IS NOT NULL THEN
    desired_username := provided_username;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(desired_username)) THEN
      RAISE EXCEPTION 'username_taken' USING ERRCODE = '23505';
    END IF;
  ELSE
    -- OAuth sign-up (no username in metadata): generate a unique placeholder
    -- and require the user to pick a real username on first launch.
    needs_pick := true;
    LOOP
      desired_username := 'user_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE lower(username) = lower(desired_username)
      );
    END LOOP;
  END IF;

  INSERT INTO public.profiles (user_id, username, email, phone, date_of_birth, needs_username)
  VALUES (
    NEW.id,
    desired_username,
    NEW.email,
    NEW.phone,
    CASE
      WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'date_of_birth')::date
      ELSE NULL
    END,
    needs_pick
  );
  RETURN NEW;
END;
$function$;