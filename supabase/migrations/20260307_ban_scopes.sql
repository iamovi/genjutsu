-- Fine-grained ban scopes (posts, social, messages)

-- 1) Add ban_scopes to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ban_scopes TEXT[] DEFAULT '{}'::text[];

-- 2) Helper to check if a given action is allowed for the current user
-- p_action examples: 'post', 'comment', 'social', 'message'
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

-- 3) Update admin_ban_user to accept scopes (which actions to block)
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

-- 4) Ensure unban clears scopes as well
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

-- 5) Update create_post to respect ban scopes
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
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- 6) Update create_comment to respect ban scopes
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
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- 7) Update RLS policies to respect social/message bans

-- Likes
DROP POLICY IF EXISTS "Users can like posts" ON public.likes;
CREATE POLICY "Users can like posts"
  ON public.likes FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id AND public.is_action_allowed('social'));

DROP POLICY IF EXISTS "Users can unlike posts" ON public.likes;
CREATE POLICY "Users can unlike posts"
  ON public.likes FOR DELETE
  USING ((select auth.uid()) = user_id AND public.is_action_allowed('social'));

-- Bookmarks
DROP POLICY IF EXISTS "Users can bookmark posts" ON public.bookmarks;
CREATE POLICY "Users can bookmark posts"
  ON public.bookmarks FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id AND public.is_action_allowed('social'));

DROP POLICY IF EXISTS "Users can remove bookmarks" ON public.bookmarks;
CREATE POLICY "Users can remove bookmarks"
  ON public.bookmarks FOR DELETE
  USING ((select auth.uid()) = user_id AND public.is_action_allowed('social'));

-- Follows
DROP POLICY IF EXISTS "Users can follow" ON public.follows;
CREATE POLICY "Users can follow"
  ON public.follows FOR INSERT
  WITH CHECK ((select auth.uid()) = follower_id AND public.is_action_allowed('social'));

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  USING ((select auth.uid()) = follower_id AND public.is_action_allowed('social'));

-- Messages (whispers)
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK ((select auth.uid()) = sender_id AND public.is_action_allowed('message'));

