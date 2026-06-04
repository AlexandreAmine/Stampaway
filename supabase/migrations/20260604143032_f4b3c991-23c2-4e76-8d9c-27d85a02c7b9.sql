CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE lower(p.username) = lower(trim(_username))
      AND u.email_confirmed_at IS NOT NULL
  );
$function$;