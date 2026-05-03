-- Migration: Game Submission Notifications
-- Allows the 'game_submission' notification type and provides an RPC to notify admins

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
      'mention',
      'game_submission'
    )
  );

-- 2. RPC to notify admins when a new game is submitted
CREATE OR REPLACE FUNCTION public.notify_admins_new_game(p_actor_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Insert a notification for each admin
  -- (We optionally skip notifying an admin if they themselves submitted it)
  INSERT INTO public.notifications (user_id, actor_id, type)
  SELECT user_id, p_actor_id, 'game_submission'
  FROM public.admin_users
  WHERE user_id <> p_actor_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
