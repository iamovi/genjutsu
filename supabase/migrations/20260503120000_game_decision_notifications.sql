-- Migration: Game Decision Notifications
-- Allows 'game_approved' and 'game_rejected' notification types

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
      'game_rejected'
    )
  );
