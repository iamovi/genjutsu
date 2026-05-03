-- Game House Migration
-- Creates the game_house table, storage bucket, and RLS policies

CREATE TABLE IF NOT EXISTS public.game_house (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  html_storage_path TEXT NOT NULL,
  submitted_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  play_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for game_house
ALTER TABLE public.game_house ENABLE ROW LEVEL SECURITY;

-- 1. Public can read approved games
CREATE POLICY "Public can view approved games"
  ON public.game_house
  FOR SELECT
  USING (status = 'approved');

-- 2. Users can read their own pending/rejected submissions
CREATE POLICY "Users can view their own submissions"
  ON public.game_house
  FOR SELECT
  USING (auth.uid() = submitted_by);

-- 3. Admins can read all submissions
CREATE POLICY "Admins can view all submissions"
  ON public.game_house
  FOR SELECT
  USING (public.is_admin());

-- 4. Authenticated users can insert pending submissions
CREATE POLICY "Authenticated users can submit games"
  ON public.game_house
  FOR INSERT
  WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

-- 5. Admins can update status
CREATE POLICY "Admins can update game status"
  ON public.game_house
  FOR UPDATE
  USING (public.is_admin());

-- 6. Admins can delete submissions
CREATE POLICY "Admins can delete games"
  ON public.game_house
  FOR DELETE
  USING (public.is_admin());

-- Storage Bucket for Game House HTML
INSERT INTO storage.buckets (id, name, public) 
VALUES ('game-house', 'game-house', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage.objects on game-house bucket
-- Users can upload
CREATE POLICY "Authenticated users can upload game HTML"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'game-house' AND auth.role() = 'authenticated');

-- Users can read their own uploads (for preview)
CREATE POLICY "Users can read their own uploads"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'game-house' AND auth.uid() = owner);

-- Admins can manage all objects in the bucket
CREATE POLICY "Admins can manage all game HTML"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'game-house' AND public.is_admin());

-- RPC to increment play count securely
CREATE OR REPLACE FUNCTION public.increment_game_play_count(p_game_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Only increment if it is approved, or if admin. But realistically, anyone viewing increments it.
  UPDATE public.game_house
  SET play_count = play_count + 1
  WHERE id = p_game_id AND status = 'approved';
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
