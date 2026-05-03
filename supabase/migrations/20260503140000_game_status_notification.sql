-- Migration: Add RPC for game status notifications

CREATE OR REPLACE FUNCTION public.notify_user_game_status(p_user_id UUID, p_actor_id UUID, p_status TEXT)
RETURNS VOID AS $$
BEGIN
  IF p_status = 'approved' THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (p_user_id, p_actor_id, 'game_approved');
  ELSIF p_status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (p_user_id, p_actor_id, 'game_rejected');
  END IF;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
