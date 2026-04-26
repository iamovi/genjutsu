CREATE INDEX IF NOT EXISTS idx_likes_post_created_at
  ON public.likes (post_id, created_at DESC);
