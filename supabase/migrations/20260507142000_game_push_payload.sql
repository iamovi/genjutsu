-- Include game_id in notification push payload so Edge Function can deep-link game interactions

CREATE OR REPLACE FUNCTION public.send_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_project_url TEXT;
  v_service_key TEXT;
BEGIN
  -- Get the Supabase URL and service role key from vault
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
          'post_id', NEW.post_id,
          'game_id', NEW.game_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault;
