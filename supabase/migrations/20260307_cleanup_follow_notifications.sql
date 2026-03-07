-- =============================================================================
-- Migration: Cleanup Follow/Unfollow Notifications After 24 Hours
-- Keeps the notifications table lean by deleting old follow/unfollow events,
-- without touching post/comment-based notifications (which are already cleaned
-- up by cascading deletes from posts/comments).
-- =============================================================================

-- Function to delete follow/unfollow notifications older than 24 hours
CREATE OR REPLACE FUNCTION public.delete_expired_follow_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - INTERVAL '24 hours'
    AND type IN ('follow', 'unfollow');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Schedule the cleanup to run every hour (reuses existing pg_cron extension)
SELECT cron.schedule(
  'cleanup_follow_notifications_every_hour',
  '0 * * * *',
  'SELECT public.delete_expired_follow_notifications()'
);

