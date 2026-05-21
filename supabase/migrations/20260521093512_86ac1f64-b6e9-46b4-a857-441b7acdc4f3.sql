-- Device tokens table
CREATE TABLE public.device_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  bundle_id TEXT NOT NULL DEFAULT 'com.alexandreamine.stampaway',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE INDEX idx_device_tokens_user ON public.device_tokens(user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own device tokens"
  ON public.device_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device tokens"
  ON public.device_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device tokens"
  ON public.device_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device tokens"
  ON public.device_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper to invoke edge function via pg_net
CREATE OR REPLACE FUNCTION public.notify_push(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text := 'https://bqjbvyvxdkesyrywlmkg.supabase.co/functions/v1/send-push';
  service_key text;
BEGIN
  service_key := current_setting('app.settings.service_role_key', true);
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, '')
    ),
    body := payload
  );
EXCEPTION WHEN OTHERS THEN
  -- Never block the originating write
  NULL;
END;
$$;

-- Follower created
CREATE OR REPLACE FUNCTION public.on_follower_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_push(jsonb_build_object(
    'type', 'follow',
    'recipient_id', NEW.following_id,
    'actor_id', NEW.follower_id
  ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_followers_push
  AFTER INSERT ON public.followers
  FOR EACH ROW EXECUTE FUNCTION public.on_follower_created();

-- Follow request created
CREATE OR REPLACE FUNCTION public.on_follow_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_push(jsonb_build_object(
    'type', 'follow_request',
    'recipient_id', NEW.target_id,
    'actor_id', NEW.requester_id
  ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_follow_requests_push
  AFTER INSERT ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_follow_request_created();

-- Review liked
CREATE OR REPLACE FUNCTION public.on_review_like_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM public.reviews WHERE id = NEW.review_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    PERFORM public.notify_push(jsonb_build_object(
      'type', 'review_like',
      'recipient_id', owner_id,
      'actor_id', NEW.user_id,
      'review_id', NEW.review_id
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_review_likes_push
  AFTER INSERT ON public.review_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_review_like_created();

-- Review commented
CREATE OR REPLACE FUNCTION public.on_review_comment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM public.reviews WHERE id = NEW.review_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    PERFORM public.notify_push(jsonb_build_object(
      'type', 'review_comment',
      'recipient_id', owner_id,
      'actor_id', NEW.user_id,
      'review_id', NEW.review_id,
      'comment_text', NEW.comment_text
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_review_comments_push
  AFTER INSERT ON public.review_comments
  FOR EACH ROW EXECUTE FUNCTION public.on_review_comment_created();

-- List liked
CREATE OR REPLACE FUNCTION public.on_list_like_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM public.lists WHERE id = NEW.list_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    PERFORM public.notify_push(jsonb_build_object(
      'type', 'list_like',
      'recipient_id', owner_id,
      'actor_id', NEW.user_id,
      'list_id', NEW.list_id
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_list_likes_push
  AFTER INSERT ON public.list_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_list_like_created();

-- Enable pg_net for HTTP from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;