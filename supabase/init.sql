-- =============================================================================
-- genjutsu — init.sql
-- Consolidated database setup for a fresh Supabase project.
-- Run this ONCE in the Supabase SQL Editor to set up the entire database.
--
-- AFTER running this, you must also:
--   1. Set your .env file with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
--   2. Store your service_role key in Vault (for auto storage cleanup):
--      SELECT vault.create_secret('supabase_service_role_key', 'YOUR_KEY');
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- =============================================================================
-- TABLES
-- =============================================================================

-- Admin Users (Moderation System)
CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Admin Verification Helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  social_links JSONB DEFAULT '{}'::jsonb,
  fav_song JSONB DEFAULT NULL,
  banned_until TIMESTAMPTZ,
  ban_reason TEXT,
  ban_scopes TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  whisper_last_seen_at TIMESTAMPTZ DEFAULT now()
);

-- Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  code TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  is_readme BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Likes
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Bookmarks
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Follows
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Messages (Whispers)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Action Log (for rate limiting cooldowns)
CREATE TABLE public.user_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_action_idempotency
  ON public.user_action_log (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_user_action_lookup
  ON public.user_action_log (user_id, action_type, created_at DESC);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'unlike', 'comment', 'uncomment', 'follow', 'unfollow', 'mention')),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications (user_id, is_read) WHERE is_read = false;


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING ((select auth.uid()) = user_id);

-- Posts (INSERT blocked — must use create_post() function)
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can update their own posts"
  ON public.posts FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own posts"
  ON public.posts FOR DELETE USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can delete any post"
  ON public.posts FOR DELETE USING (public.is_admin());

-- Likes
CREATE POLICY "Likes are viewable by everyone"
  ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts"
  ON public.likes FOR INSERT WITH CHECK ((select auth.uid()) = user_id AND public.is_action_allowed('social'));
CREATE POLICY "Users can unlike posts"
  ON public.likes FOR DELETE USING ((select auth.uid()) = user_id AND public.is_action_allowed('social'));

-- Bookmarks
CREATE POLICY "Users can view their own bookmarks"
  ON public.bookmarks FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can bookmark posts"
  ON public.bookmarks FOR INSERT WITH CHECK ((select auth.uid()) = user_id AND public.is_action_allowed('social'));
CREATE POLICY "Users can remove bookmarks"
  ON public.bookmarks FOR DELETE USING ((select auth.uid()) = user_id AND public.is_action_allowed('social'));

-- Follows
CREATE POLICY "Follows are viewable by everyone"
  ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow"
  ON public.follows FOR INSERT WITH CHECK ((select auth.uid()) = follower_id AND public.is_action_allowed('social'));
CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE USING ((select auth.uid()) = follower_id AND public.is_action_allowed('social'));

-- Comments (INSERT blocked — must use create_comment() function)
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE USING ((select auth.uid()) = user_id);
CREATE POLICY "Admins can delete any comment"
  ON public.comments FOR DELETE USING (public.is_admin());

-- User Action Log
CREATE POLICY "Users can view own action log"
  ON public.user_action_log FOR SELECT USING ((select auth.uid()) = user_id);

-- Messages
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT USING ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id);
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT WITH CHECK ((select auth.uid()) = sender_id AND public.is_action_allowed('message'));
CREATE POLICY "Receivers can mark messages as read"
  ON public.messages FOR UPDATE USING ((select auth.uid()) = receiver_id);

-- Notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE USING ((select auth.uid()) = user_id);


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Guard: Prevent direct username changes (bypass protection)
CREATE OR REPLACE FUNCTION public.prevent_direct_username_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    IF current_setting('app.allow_username_change', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Use the change_username() function to change your username';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_username_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_username_change();

-- Auto-create profile on signup (supports email/password + Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    LOWER(REPLACE(COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    ), ' ', '')),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      ''
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- =============================================================================
-- STORAGE BUCKETS & POLICIES
-- =============================================================================

-- Post media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Banners bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- post-media policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access') THEN
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'post-media' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload') THEN
    CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'post-media' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete post media') THEN
    CREATE POLICY "Users can delete post media" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'post-media' );
  END IF;
END $$;

-- avatars policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access for Avatars') THEN
    CREATE POLICY "Public Access for Avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload avatars') THEN
    CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own avatars') THEN
    CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text );
  END IF;
END $$;

-- banners policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access for Banners') THEN
    CREATE POLICY "Public Access for Banners" ON storage.objects FOR SELECT USING ( bucket_id = 'banners' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload banners') THEN
    CREATE POLICY "Authenticated users can upload banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'banners' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own banners') THEN
    CREATE POLICY "Users can delete their own banners" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text );
  END IF;
END $$;


-- =============================================================================
-- 24-HOUR EXPIRATION (CRON JOBS)
-- =============================================================================

-- Delete expired posts + clean up storage files via pg_net
-- REQUIRES: vault secret 'supabase_service_role_key' to be set
CREATE OR REPLACE FUNCTION public.delete_expired_posts()
RETURNS void AS $$
DECLARE
  expired_post RECORD;
  file_path TEXT;
  service_key TEXT;
BEGIN
  -- Get the service role key from Supabase Vault
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  -- If we have the key, clean up storage files first
  IF service_key IS NOT NULL THEN
    FOR expired_post IN
      SELECT id, media_url FROM public.posts
      WHERE created_at < now() - INTERVAL '24 hours'
        AND media_url IS NOT NULL
        AND media_url <> ''
        AND media_url LIKE '%post-media%'
    LOOP
      file_path := split_part(expired_post.media_url, 'post-media/', 2);

      IF file_path IS NOT NULL AND file_path <> '' THEN
        PERFORM net.http_delete(
          url := 'https://scvikrxfxijqoedfryvx.supabase.co/storage/v1/object/post-media/' || file_path,
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || service_key
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- Delete expired posts (CASCADE handles comments, likes, bookmarks)
  DELETE FROM public.posts
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault, extensions;

-- Delete expired whispers
CREATE OR REPLACE FUNCTION public.delete_expired_whispers()
RETURNS void AS $$
BEGIN
  DELETE FROM public.messages
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Delete expired action log entries (preserve username_change for 7 days, others 48h)
CREATE OR REPLACE FUNCTION public.delete_expired_action_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_action_log
  WHERE (action_type != 'username_change' AND created_at < now() - INTERVAL '48 hours')
     OR (action_type = 'username_change' AND created_at < now() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Delete expired follow/unfollow notifications
CREATE OR REPLACE FUNCTION public.delete_expired_follow_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - INTERVAL '24 hours'
    AND type IN ('follow', 'unfollow');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Schedule cleanups (every hour)
SELECT cron.schedule('0 * * * *', 'SELECT public.delete_expired_posts()');
SELECT cron.schedule('5 * * * *', 'SELECT public.delete_expired_whispers()');
SELECT cron.schedule('10 * * * *', 'SELECT public.delete_expired_action_logs()');
SELECT cron.schedule('15 * * * *', 'SELECT public.delete_expired_follow_notifications()');


-- =============================================================================
-- SERVER-SIDE RATE-LIMITED & MODERATION FUNCTIONS
-- =============================================================================

-- Helper: Check if a given action is allowed for the current user (Fine-grained bans)
CREATE OR REPLACE FUNCTION public.is_action_allowed(p_action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_banned_until TIMESTAMPTZ;
  v_scopes TEXT[];
BEGIN
  SELECT banned_until, ban_scopes
  INTO v_banned_until, v_scopes
  FROM public.profiles
  WHERE user_id = auth.uid();

  -- Not banned or ban expired → everything allowed
  IF v_banned_until IS NULL OR v_banned_until <= now() THEN
    RETURN true;
  END IF;

  -- Banned and no specific scopes set → block all actions
  IF v_scopes IS NULL OR array_length(v_scopes, 1) IS NULL THEN
    RETURN false;
  END IF;

  -- If this action is in the blocked scopes → disallow
  IF p_action = ANY (v_scopes) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Admin RPC: admin_ban_user
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_user_id UUID,
  p_minutes INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_scopes TEXT[] DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_until TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_until := now() + make_interval(mins => p_minutes);

  UPDATE public.profiles
  SET banned_until = v_until,
      ban_reason = COALESCE(p_reason, ban_reason),
      ban_scopes = COALESCE(p_scopes, '{}'::text[])
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Admin RPC: admin_unban_user
CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.profiles
  SET banned_until = NULL,
      ban_scopes = '{}'::text[]
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- RPC: change_username (7-day cooldown, format validation, trigger-safe)
CREATE OR REPLACE FUNCTION public.change_username(p_new_username TEXT)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_normalized TEXT;
  v_last_change_at TIMESTAMPTZ;
  v_days_remaining INT;
  v_cooldown_days INT := 7;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- Normalize
  v_normalized := LOWER(TRIM(p_new_username));

  -- Validate format
  IF LENGTH(v_normalized) < 3 OR LENGTH(v_normalized) > 20 THEN
    RETURN jsonb_build_object('error', 'invalid_format', 'message', 'Username must be 3–20 characters');
  END IF;

  IF v_normalized !~ '^[a-z0-9_]+$' THEN
    RETURN jsonb_build_object('error', 'invalid_format', 'message', 'Only lowercase letters, numbers, and underscores allowed');
  END IF;

  -- Check if unchanged
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = v_user_id AND username = v_normalized) THEN
    RETURN jsonb_build_object('error', 'unchanged', 'message', 'That is already your username');
  END IF;

  -- Check cooldown (7 days)
  SELECT MAX(created_at) INTO v_last_change_at
  FROM public.user_action_log
  WHERE user_id = v_user_id AND action_type = 'username_change';

  IF v_last_change_at IS NOT NULL AND v_last_change_at > now() - make_interval(days => v_cooldown_days) THEN
    v_days_remaining := CEIL(EXTRACT(EPOCH FROM (v_last_change_at + make_interval(days => v_cooldown_days) - now())) / 86400)::INT;
    RETURN jsonb_build_object(
      'error', 'cooldown_active',
      'message', 'You can change your username again in ' || v_days_remaining || ' day' || CASE WHEN v_days_remaining != 1 THEN 's' ELSE '' END,
      'retry_after_days', v_days_remaining,
      'available_at', v_last_change_at + make_interval(days => v_cooldown_days)
    );
  END IF;

  -- Check uniqueness
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = v_normalized AND user_id != v_user_id) THEN
    RETURN jsonb_build_object('error', 'username_taken', 'message', 'This username is already taken');
  END IF;

  -- Set session variable to allow the trigger to pass
  PERFORM set_config('app.allow_username_change', 'true', true);

  -- Perform the update
  UPDATE public.profiles
  SET username = v_normalized
  WHERE user_id = v_user_id;

  -- Log the action for cooldown tracking
  INSERT INTO public.user_action_log (user_id, action_type)
  VALUES (v_user_id, 'username_change');

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC: get_username_cooldown (single source of truth for cooldown period)
CREATE OR REPLACE FUNCTION public.get_username_cooldown()
RETURNS JSONB AS $$
DECLARE
  v_last_change_at TIMESTAMPTZ;
  v_cooldown_days INT := 7;
  v_available_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('on_cooldown', false);
  END IF;

  SELECT MAX(created_at) INTO v_last_change_at
  FROM public.user_action_log
  WHERE user_id = auth.uid() AND action_type = 'username_change';

  IF v_last_change_at IS NULL THEN
    RETURN jsonb_build_object('on_cooldown', false);
  END IF;

  v_available_at := v_last_change_at + make_interval(days => v_cooldown_days);

  IF v_available_at > now() THEN
    RETURN jsonb_build_object('on_cooldown', true, 'available_at', v_available_at);
  ELSE
    RETURN jsonb_build_object('on_cooldown', false);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Admin RPC: admin_delete_post
CREATE OR REPLACE FUNCTION public.admin_delete_post(p_post_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  DELETE FROM public.posts
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- create_post: 30s cooldown, idempotency support, respects ban scopes
CREATE OR REPLACE FUNCTION public.create_post(
  p_content TEXT,
  p_code TEXT DEFAULT '',
  p_tags TEXT[] DEFAULT '{}',
  p_media_url TEXT DEFAULT '',
  p_is_readme BOOLEAN DEFAULT false,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_last_action_at TIMESTAMPTZ;
  v_seconds_since_last NUMERIC;
  v_cooldown_seconds INT := 30;
  v_retry_after INT;
  v_new_post_id UUID;
  v_banned_until TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- Ban check for posting
  SELECT banned_until INTO v_banned_until
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_banned_until IS NOT NULL AND v_banned_until > now() AND NOT public.is_action_allowed('post') THEN
    RETURN jsonb_build_object(
      'error', 'banned',
      'message', 'You are temporarily banned from posting',
      'banned_until', v_banned_until
    );
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_action_log
      WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'deduplicated', true);
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('post:' || v_user_id::text));

  SELECT MAX(created_at) INTO v_last_action_at
  FROM public.user_action_log
  WHERE user_id = v_user_id AND action_type = 'post';

  IF v_last_action_at IS NOT NULL THEN
    v_seconds_since_last := EXTRACT(EPOCH FROM (now() - v_last_action_at));
    IF v_seconds_since_last < v_cooldown_seconds THEN
      v_retry_after := CEIL(v_cooldown_seconds - v_seconds_since_last)::INT;
      RETURN jsonb_build_object(
        'error', 'cooldown_active',
        'message', 'Please wait before posting again',
        'retry_after', v_retry_after
      );
    END IF;
  END IF;

  INSERT INTO public.posts (user_id, content, code, tags, media_url, is_readme)
  VALUES (v_user_id, p_content, p_code, p_tags, p_media_url, p_is_readme)
  RETURNING id INTO v_new_post_id;

  INSERT INTO public.user_action_log (user_id, action_type, idempotency_key)
  VALUES (v_user_id, 'post', COALESCE(p_idempotency_key, v_new_post_id::text));

  RETURN jsonb_build_object('success', true, 'post_id', v_new_post_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- create_comment: 15s cooldown, idempotency support, respects ban scopes
CREATE OR REPLACE FUNCTION public.create_comment(
  p_post_id UUID,
  p_content TEXT,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_last_action_at TIMESTAMPTZ;
  v_seconds_since_last NUMERIC;
  v_cooldown_seconds INT := 15;
  v_retry_after INT;
  v_new_comment_id UUID;
  v_banned_until TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- Ban check for commenting
  SELECT banned_until INTO v_banned_until
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_banned_until IS NOT NULL AND v_banned_until > now() AND NOT public.is_action_allowed('comment') THEN
    RETURN jsonb_build_object(
      'error', 'banned',
      'message', 'You are temporarily banned from commenting',
      'banned_until', v_banned_until
    );
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_action_log
      WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'deduplicated', true);
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('comment:' || v_user_id::text));

  SELECT MAX(created_at) INTO v_last_action_at
  FROM public.user_action_log
  WHERE user_id = v_user_id AND action_type = 'comment';

  IF v_last_action_at IS NOT NULL THEN
    v_seconds_since_last := EXTRACT(EPOCH FROM (now() - v_last_action_at));
    IF v_seconds_since_last < v_cooldown_seconds THEN
      v_retry_after := CEIL(v_cooldown_seconds - v_seconds_since_last)::INT;
      RETURN jsonb_build_object(
        'error', 'cooldown_active',
        'message', 'Please wait before commenting again',
        'retry_after', v_retry_after
      );
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id) THEN
    RETURN jsonb_build_object('error', 'post_not_found', 'message', 'Post not found');
  END IF;

  INSERT INTO public.comments (post_id, user_id, content)
  VALUES (p_post_id, v_user_id, p_content)
  RETURNING id INTO v_new_comment_id;

  INSERT INTO public.user_action_log (user_id, action_type, idempotency_key)
  VALUES (v_user_id, 'comment', COALESCE(p_idempotency_key, v_new_comment_id::text));

  RETURN jsonb_build_object('success', true, 'comment_id', v_new_comment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- delete_comment: server-side comment deletion (bypasses RLS, checks ownership/admin)
CREATE OR REPLACE FUNCTION public.delete_comment(p_comment_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_comment_owner UUID;
  v_post_id UUID;
  v_post_owner UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- Get comment metadata
  SELECT user_id, post_id INTO v_comment_owner, v_post_id
  FROM public.comments
  WHERE id = p_comment_id;

  IF v_comment_owner IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'Comment not found');
  END IF;

  -- Get post owner
  SELECT user_id INTO v_post_owner
  FROM public.posts
  WHERE id = v_post_id;

  -- Check authorization: must be comment owner, post owner, or admin
  IF v_comment_owner != v_user_id AND v_post_owner != v_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_authorized', 'message', 'You can only delete your own comments (or echoes on your posts)');
  END IF;

  DELETE FROM public.comments WHERE id = p_comment_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- NOTIFICATION TRIGGERS
-- =============================================================================

-- On like → notify post owner (skip self-like)
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  v_post_owner UUID;
BEGIN
  SELECT user_id INTO v_post_owner FROM public.posts WHERE id = NEW.post_id;
  IF v_post_owner IS NOT NULL AND v_post_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (v_post_owner, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_like_notify
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- On unlike → notify post owner (skip self-unlike)
CREATE OR REPLACE FUNCTION public.notify_on_unlike()
RETURNS TRIGGER AS $$
DECLARE
  v_post_owner UUID;
BEGIN
  -- Only create a notification when the authenticated user is the liker
  IF auth.uid() IS NULL OR auth.uid() <> OLD.user_id THEN
    RETURN OLD;
  END IF;

  SELECT user_id INTO v_post_owner
  FROM public.posts
  WHERE id = OLD.post_id;

  IF v_post_owner IS NOT NULL AND v_post_owner <> OLD.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (v_post_owner, OLD.user_id, 'unlike', OLD.post_id);
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_unlike_notify
  AFTER DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_unlike();

-- On comment → notify post owner (skip self-comment)
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_post_owner UUID;
BEGIN
  SELECT user_id INTO v_post_owner FROM public.posts WHERE id = NEW.post_id;
  IF v_post_owner IS NOT NULL AND v_post_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id, comment_id)
    VALUES (v_post_owner, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_comment_notify
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- On uncomment → notify post owner (skip self-uncomment)
CREATE OR REPLACE FUNCTION public.notify_on_uncomment()
RETURNS TRIGGER AS $$
DECLARE
  v_post_owner UUID;
BEGIN
  -- Only create a notification when the authenticated user is the commenter
  IF auth.uid() IS NULL OR auth.uid() <> OLD.user_id THEN
    RETURN OLD;
  END IF;

  SELECT user_id INTO v_post_owner
  FROM public.posts
  WHERE id = OLD.post_id;

  IF v_post_owner IS NOT NULL AND v_post_owner <> OLD.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (v_post_owner, OLD.user_id, 'uncomment', OLD.post_id);
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_uncomment_notify
  AFTER DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_uncomment();

-- On follow → notify followed user
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.follower_id <> NEW.following_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_follow_notify
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- On unfollow → notify unfollowed user
CREATE OR REPLACE FUNCTION public.notify_on_unfollow()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create a notification when the authenticated user is the follower
  IF auth.uid() IS NULL OR auth.uid() <> OLD.follower_id THEN
    RETURN OLD;
  END IF;

  IF OLD.follower_id <> OLD.following_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (OLD.following_id, OLD.follower_id, 'unfollow');
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_unfollow_notify
  AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_unfollow();


-- Mention handling: Extract mentions (@username) and notify users
CREATE OR REPLACE FUNCTION public.handle_mentions(
  p_content TEXT,
  p_actor_id UUID,
  p_post_id UUID,
  p_comment_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_mention RECORD;
  v_target_user_id UUID;
BEGIN
  FOR v_mention IN 
    SELECT DISTINCT (regexp_matches(p_content, '(^|[^a-z0-9_])@([a-z0-9_]{3,30})(?![a-z0-9_])', 'gi'))[2] as username
  LOOP
    SELECT user_id INTO v_target_user_id FROM public.profiles WHERE LOWER(username) = LOWER(v_mention.username);

    IF v_target_user_id IS NOT NULL AND v_target_user_id <> p_actor_id THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications 
        WHERE user_id = v_target_user_id 
          AND actor_id = p_actor_id 
          AND type = 'mention' 
          AND post_id = p_post_id 
          AND (p_comment_id IS NULL OR comment_id = p_comment_id)
      ) THEN
        INSERT INTO public.notifications (user_id, actor_id, type, post_id, comment_id)
        VALUES (v_target_user_id, p_actor_id, 'mention', p_post_id, p_comment_id);
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Notification on post mention
CREATE OR REPLACE FUNCTION public.notify_on_post_mention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NOT NULL AND NEW.content <> '' THEN
    PERFORM public.handle_mentions(NEW.content, NEW.user_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_post_mention_notify
  AFTER INSERT OR UPDATE OF content ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_mention();

-- Trigger: Notification on comment mention
CREATE OR REPLACE FUNCTION public.notify_on_comment_mention()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NOT NULL AND NEW.content <> '' THEN
    PERFORM public.handle_mentions(NEW.content, NEW.user_id, NEW.post_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_comment_mention_notify
  AFTER INSERT OR UPDATE OF content ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment_mention();


-- =============================================================================
-- ACCOUNT MANAGEMENT
-- =============================================================================

-- Delete user account and all associated data (including storage cleanup)
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS jsonb AS $$
DECLARE
    v_user_id UUID;
    v_project_id TEXT := 'scvikrxfxijqoedfryvx';
    v_service_key TEXT;
    v_record RECORD;
    v_file_path TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('error', 'unauthorized', 'message', 'You must be logged in');
    END IF;

    -- Get service role key for storage cleanup
    SELECT decrypted_secret INTO v_service_key
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_service_role_key'
    LIMIT 1;

    -- Cleanup Storage
    IF v_service_key IS NOT NULL THEN
        -- Post Media
        FOR v_record IN SELECT media_url FROM public.posts WHERE user_id = v_user_id AND media_url IS NOT NULL AND media_url <> '' LOOP
            v_file_path := split_part(v_record.media_url, 'post-media/', 2);
            IF v_file_path IS NOT NULL AND v_file_path <> '' THEN
                PERFORM net.http_delete(
                    url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/post-media/' || v_file_path,
                    headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key)
                );
            END IF;
        END LOOP;

        -- Avatar & Banner
        FOR v_record IN SELECT avatar_url, banner_url FROM public.profiles WHERE user_id = v_user_id LOOP
            -- Avatar
            IF v_record.avatar_url IS NOT NULL AND v_record.avatar_url <> '' THEN
                v_file_path := split_part(v_record.avatar_url, 'avatars/', 2);
                IF v_file_path IS NOT NULL AND v_file_path <> '' THEN
                    PERFORM net.http_delete(
                        url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/avatars/' || v_file_path,
                        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key)
                    );
                END IF;
            END IF;
            -- Banner
            IF v_record.banner_url IS NOT NULL AND v_record.banner_url <> '' THEN
                v_file_path := split_part(v_record.banner_url, 'banners/', 2);
                IF v_file_path IS NOT NULL AND v_file_path <> '' THEN
                    PERFORM net.http_delete(
                        url := 'https://' || v_project_id || '.supabase.co/storage/v1/object/banners/' || v_file_path,
                        headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_key)
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    DELETE FROM auth.users WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Account and data wiped');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('error', 'internal_error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions, vault, net;
