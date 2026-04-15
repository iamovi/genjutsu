-- Whisper image support (DM only)
-- 1) Add media_url to messages
-- 2) Create public storage bucket for whisper media
-- 3) Add storage policies for upload/delete
-- 4) Upgrade whisper cleanup to remove expired storage files
-- 5) Upgrade whisper push trigger payload to include media flag

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Safety: remove any legacy invalid rows before enforcing text-or-media check.
DELETE FROM public.messages
WHERE nullif(btrim(content), '') IS NULL
  AND media_url IS NULL;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_or_media_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_or_media_check
  CHECK (nullif(btrim(content), '') IS NOT NULL OR media_url IS NOT NULL);

-- Bucket for whisper attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('whisper-media', 'whisper-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public Access for Whisper Media'
  ) THEN
    CREATE POLICY "Public Access for Whisper Media"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'whisper-media');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload whisper media'
  ) THEN
    CREATE POLICY "Authenticated users can upload whisper media"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'whisper-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own whisper media'
  ) THEN
    CREATE POLICY "Users can delete own whisper media"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'whisper-media'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.delete_expired_whispers()
RETURNS void AS $$
DECLARE
  expired_message RECORD;
  file_path TEXT;
  service_key TEXT;
  project_url TEXT;
BEGIN
  project_url := current_setting('app.settings.supabase_url', true);
  IF project_url IS NULL OR project_url = '' THEN
    project_url := 'https://scvikrxfxijqoedfryvx.supabase.co';
  END IF;

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  IF service_key IS NOT NULL THEN
    FOR expired_message IN
      SELECT media_url
      FROM public.messages
      WHERE created_at < now() - INTERVAL '24 hours'
        AND media_url IS NOT NULL
        AND media_url <> ''
        AND media_url LIKE '%/storage/v1/object/public/whisper-media/%'
    LOOP
      file_path := split_part(expired_message.media_url, 'whisper-media/', 2);
      file_path := split_part(split_part(file_path, '?', 1), '#', 1);

      IF file_path IS NOT NULL AND file_path <> '' THEN
        PERFORM net.http_delete(
          url := project_url || '/storage/v1/object/whisper-media/' || file_path,
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || service_key
          )
        );
      END IF;
    END LOOP;
  END IF;

  DELETE FROM public.messages
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault, extensions;

CREATE OR REPLACE FUNCTION public.send_whisper_push_notification()
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
    IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.receiver_id) THEN
      PERFORM net.http_post(
        url := v_project_url || '/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'user_id', NEW.receiver_id,
          'type', 'whisper',
          'actor_id', NEW.sender_id,
          'message_content', CASE
            WHEN nullif(btrim(NEW.content), '') IS NOT NULL THEN LEFT(NEW.content, 150)
            ELSE ''
          END,
          'has_media', NEW.media_url IS NOT NULL
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault;
