-- =============================================================================
-- Push Notifications — Web Push API support
-- =============================================================================
-- Requires: pg_net extension (enable in Supabase Dashboard → Database → Extensions)

-- Push subscription storage
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS: users can only manage their own subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE USING ((select auth.uid()) = user_id);

-- RPC: Upsert push subscription (removes endpoint from other users first)
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT
)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Remove this endpoint from any other user (same browser, different account)
  DELETE FROM public.push_subscriptions
  WHERE endpoint = p_endpoint AND user_id <> v_user_id;

  -- Upsert for the current user
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
  VALUES (v_user_id, p_endpoint, p_p256dh, p_auth)
  ON CONFLICT (user_id, endpoint)
  DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function: call Supabase Edge Function send-push via pg_net
-- Uses supabase_service_role_key from Vault to authenticate
CREATE OR REPLACE FUNCTION public.send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_project_url TEXT;
  v_service_key TEXT;
BEGIN
  v_project_url := current_setting('app.settings.supabase_url', true);
  IF v_project_url IS NULL OR v_project_url = '' THEN
    v_project_url := 'https://scvikrxfxijqoedfryvx.supabase.co';
  END IF;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  IF v_service_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN
      PERFORM net.http_post(
        url := v_project_url || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'user_id', NEW.user_id,
          'type', NEW.type,
          'actor_id', NEW.actor_id,
          'post_id', NEW.post_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault;

-- Fire on every new notification
CREATE TRIGGER on_notification_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.send_push_notification();
