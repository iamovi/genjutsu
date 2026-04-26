-- Prevent FK violations in notifications during account-deletion cascades.
--
-- When a user account is deleted, cascading deletes can remove likes/comments/follows
-- rows and fire AFTER DELETE notification triggers. Those triggers may attempt to
-- insert notifications with actor_id/follower_id that no longer exists in auth.users,
-- causing notifications_actor_id_fkey violations.
--
-- This migration hardens negative-notification trigger functions by validating
-- actor and recipient existence in auth.users before inserting notifications.

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

  IF v_post_owner IS NULL OR v_post_owner = OLD.user_id THEN
    RETURN OLD;
  END IF;

  -- Guard against account-deletion cascades where either side may be deleted.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_post_owner) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, post_id)
  VALUES (v_post_owner, OLD.user_id, 'unlike', OLD.post_id);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


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

  IF v_post_owner IS NULL OR v_post_owner = OLD.user_id THEN
    RETURN OLD;
  END IF;

  -- Guard against account-deletion cascades where either side may be deleted.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_post_owner) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, post_id)
  VALUES (v_post_owner, OLD.user_id, 'uncomment', OLD.post_id);

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


CREATE OR REPLACE FUNCTION public.notify_on_unfollow()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create a notification when the authenticated user is the follower
  IF auth.uid() IS NULL OR auth.uid() <> OLD.follower_id THEN
    RETURN OLD;
  END IF;

  IF OLD.follower_id = OLD.following_id THEN
    RETURN OLD;
  END IF;

  -- Guard against account-deletion cascades where either side may be deleted.
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.follower_id) THEN
    RETURN OLD;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.following_id) THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (OLD.following_id, OLD.follower_id, 'unfollow');

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
