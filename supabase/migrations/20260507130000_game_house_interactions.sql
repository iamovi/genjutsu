-- Game House interactions: likes + comments + notifications

-- 1) Extend notifications to support game interaction routing
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES public.game_house(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_game_id
  ON public.notifications (game_id);

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'like',
      'unlike',
      'comment',
      'uncomment',
      'follow',
      'unfollow',
      'mention',
      'game_submission',
      'game_approved',
      'game_rejected',
      'game_like',
      'game_comment'
    )
  );

-- 2) Likes table
CREATE TABLE IF NOT EXISTS public.game_house_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.game_house(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_game_house_likes_game_id
  ON public.game_house_likes (game_id);

ALTER TABLE public.game_house_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game likes are visible when game is visible"
  ON public.game_house_likes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_house g
      WHERE g.id = game_id
        AND (
          g.status = 'approved'
          OR g.submitted_by = auth.uid()
          OR public.is_admin()
        )
    )
  );

CREATE POLICY "Users can like approved games"
  ON public.game_house_likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_action_allowed('social')
    AND EXISTS (
      SELECT 1
      FROM public.game_house g
      WHERE g.id = game_id
        AND g.status = 'approved'
    )
  );

CREATE POLICY "Users can unlike their own game likes"
  ON public.game_house_likes
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND public.is_action_allowed('social')
  );

-- 3) Comments table
CREATE TABLE IF NOT EXISTS public.game_house_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.game_house(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_house_comments_game_id
  ON public.game_house_comments (game_id, created_at ASC);

ALTER TABLE public.game_house_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game comments are visible when game is visible"
  ON public.game_house_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.game_house g
      WHERE g.id = game_id
        AND (
          g.status = 'approved'
          OR g.submitted_by = auth.uid()
          OR public.is_admin()
        )
    )
  );

CREATE POLICY "Users can update own game comments"
  ON public.game_house_comments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own game comments"
  ON public.game_house_comments
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any game comment"
  ON public.game_house_comments
  FOR DELETE
  USING (public.is_admin());

DROP TRIGGER IF EXISTS update_game_house_comments_updated_at ON public.game_house_comments;
CREATE TRIGGER update_game_house_comments_updated_at
  BEFORE UPDATE ON public.game_house_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RPCs
CREATE OR REPLACE FUNCTION public.create_game_comment(
  p_game_id UUID,
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
  v_ban_permanent BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RETURN jsonb_build_object('error', 'invalid_content', 'message', 'Comment cannot be empty');
  END IF;

  -- Ban check for commenting
  SELECT banned_until, ban_permanent
  INTO v_banned_until, v_ban_permanent
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF NOT public.is_action_allowed('comment') THEN
    RETURN jsonb_build_object(
      'error', 'banned',
      'message', CASE
        WHEN v_ban_permanent THEN 'You are permanently banned from commenting'
        ELSE 'You are temporarily banned from commenting'
      END,
      'banned_until', v_banned_until,
      'ban_permanent', v_ban_permanent
    );
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_action_log
      WHERE user_id = v_user_id
        AND idempotency_key = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'deduplicated', true);
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('comment:' || v_user_id::text));

  SELECT MAX(created_at) INTO v_last_action_at
  FROM public.user_action_log
  WHERE user_id = v_user_id
    AND action_type = 'comment';

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.game_house
    WHERE id = p_game_id
      AND status = 'approved'
  ) THEN
    RETURN jsonb_build_object('error', 'game_not_found', 'message', 'Game not found');
  END IF;

  INSERT INTO public.game_house_comments (game_id, user_id, content)
  VALUES (p_game_id, v_user_id, trim(p_content))
  RETURNING id INTO v_new_comment_id;

  INSERT INTO public.user_action_log (user_id, action_type, idempotency_key)
  VALUES (v_user_id, 'comment', COALESCE(p_idempotency_key, v_new_comment_id::text));

  RETURN jsonb_build_object('success', true, 'comment_id', v_new_comment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.delete_game_comment(p_comment_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_comment_owner UUID;
  v_game_id UUID;
  v_game_owner UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  SELECT user_id, game_id
  INTO v_comment_owner, v_game_id
  FROM public.game_house_comments
  WHERE id = p_comment_id;

  IF v_comment_owner IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'Comment not found');
  END IF;

  SELECT submitted_by
  INTO v_game_owner
  FROM public.game_house
  WHERE id = v_game_id;

  IF v_comment_owner != v_user_id AND v_game_owner != v_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_authorized', 'message', 'You cannot delete this comment');
  END IF;

  DELETE FROM public.game_house_comments
  WHERE id = p_comment_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5) Notification triggers for game interactions
CREATE OR REPLACE FUNCTION public.notify_on_game_like()
RETURNS TRIGGER AS $$
DECLARE
  v_game_owner UUID;
BEGIN
  SELECT submitted_by INTO v_game_owner
  FROM public.game_house
  WHERE id = NEW.game_id;

  IF v_game_owner IS NULL OR v_game_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_game_owner) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, game_id)
  VALUES (v_game_owner, NEW.user_id, 'game_like', NEW.game_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_game_like_notify ON public.game_house_likes;
CREATE TRIGGER on_game_like_notify
  AFTER INSERT ON public.game_house_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_game_like();

CREATE OR REPLACE FUNCTION public.notify_on_game_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_game_owner UUID;
BEGIN
  SELECT submitted_by INTO v_game_owner
  FROM public.game_house
  WHERE id = NEW.game_id;

  IF v_game_owner IS NULL OR v_game_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_game_owner) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, game_id)
  VALUES (v_game_owner, NEW.user_id, 'game_comment', NEW.game_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_game_comment_notify ON public.game_house_comments;
CREATE TRIGGER on_game_comment_notify
  AFTER INSERT ON public.game_house_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_game_comment();

-- 6) Cleanup function include game interaction notifications
CREATE OR REPLACE FUNCTION public.delete_expired_follow_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - INTERVAL '24 hours'
    AND type IN (
      'follow',
      'unfollow',
      'game_submission',
      'game_approved',
      'game_rejected',
      'game_like',
      'game_comment'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
