-- =============================================================================
-- Migration: Negative Action Notifications
-- Adds support for notifications when users undo actions:
-- - unlike (remove like)
-- - uncomment (delete comment)
-- - unfollow (stop following)
-- =============================================================================

-- 1. Extend notification type constraint
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
      'mention'
    )
  );

-- 2. Unlike notifications: when a user removes their like from a post
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

DROP TRIGGER IF EXISTS on_unlike_notify ON public.likes;
CREATE TRIGGER on_unlike_notify
  AFTER DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_unlike();


-- 3. Uncomment notifications: when a user deletes their comment from a post
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

DROP TRIGGER IF EXISTS on_uncomment_notify ON public.comments;
CREATE TRIGGER on_uncomment_notify
  AFTER DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_uncomment();


-- 4. Unfollow notifications: when a user stops following someone
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

DROP TRIGGER IF EXISTS on_unfollow_notify ON public.follows;
CREATE TRIGGER on_unfollow_notify
  AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_unfollow();

