-- Migration: Add Game House notifications to 24h cleanup routine

CREATE OR REPLACE FUNCTION public.delete_expired_follow_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - INTERVAL '24 hours'
    AND type IN ('follow', 'unfollow', 'game_submission', 'game_approved', 'game_rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
