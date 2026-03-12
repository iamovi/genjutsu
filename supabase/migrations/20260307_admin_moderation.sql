-- Admin & moderation utilities
-- Run this migration in Supabase to enable secure admin actions.

-- 1) Admin users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2) Helper: check if current auth user is admin
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

-- 3) Add ban fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 4) Allow admins to delete any post / comment (in addition to existing owner policies)
CREATE POLICY "Admins can delete any post"
  ON public.posts FOR DELETE
  USING (public.is_admin());

CREATE POLICY "Admins can delete any comment"
  ON public.comments FOR DELETE
  USING (public.is_admin());

-- 5) RPC: admin_delete_post
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

-- 6) RPC: admin_ban_user for N minutes (temporary ban)
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  p_user_id UUID,
  p_minutes INTEGER,
  p_reason TEXT DEFAULT NULL
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
      ban_reason = COALESCE(p_reason, ban_reason)
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- 7) RPC: admin_unban_user
CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.profiles
  SET banned_until = NULL
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- 8) Update create_post to respect bans (users cannot post while banned)
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

  -- Ban check
  SELECT banned_until INTO v_banned_until
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_banned_until IS NOT NULL AND v_banned_until > now() THEN
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
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- 9) Update create_comment to respect bans (users cannot comment while banned)
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

  -- Ban check
  SELECT banned_until INTO v_banned_until
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_banned_until IS NOT NULL AND v_banned_until > now() THEN
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
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- 10) Enable RLS on admin_users table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own admin status"
  ON public.admin_users FOR SELECT
  USING ((select auth.uid()) = user_id);

