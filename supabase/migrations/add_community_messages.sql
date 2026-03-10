-- =============================================================================
-- Community Messages (Public Group Chat)
-- Run this in Supabase SQL Editor to add the community chat feature.
-- =============================================================================

CREATE TABLE public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_community_messages_created 
  ON public.community_messages (created_at DESC);

-- RLS Policies
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "Authenticated users can read community messages"
  ON public.community_messages FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert their own
CREATE POLICY "Authenticated users can send community messages"
  ON public.community_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own community messages"
  ON public.community_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
