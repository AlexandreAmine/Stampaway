CREATE OR REPLACE FUNCTION public.is_email_taken(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(email) = lower(trim(_email))
      AND email_confirmed_at IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_email_taken(text) TO anon, authenticated;