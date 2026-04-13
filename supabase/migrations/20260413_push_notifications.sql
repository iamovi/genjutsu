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

-- Trigger function: call Cloudflare Worker /send-push via pg_net
-- Reads worker URL and API secret from Supabase Vault
CREATE OR REPLACE FUNCTION public.send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_worker_url TEXT;
  v_push_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_worker_url
  FROM vault.decrypted_secrets
  WHERE name = 'push_worker_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_push_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_api_secret'
  LIMIT 1;

  IF v_worker_url IS NOT NULL AND v_push_secret IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN
      PERFORM net.http_post(
        url := v_worker_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_push_secret
        ),
        body := jsonb_build_object('user_id', NEW.user_id)
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
