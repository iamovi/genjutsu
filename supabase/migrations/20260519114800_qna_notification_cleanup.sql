-- Delete ALL notifications older than 24 hours (not just specific types)
CREATE OR REPLACE FUNCTION public.delete_expired_follow_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
