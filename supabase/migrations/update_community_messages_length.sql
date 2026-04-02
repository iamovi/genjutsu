-- =============================================================================
-- Increase Community Messages Length
-- Run this in Supabase SQL Editor to allow the AI (and users) to post longer text and code blocks.
-- =============================================================================

ALTER TABLE public.community_messages 
DROP CONSTRAINT IF EXISTS community_messages_content_check;

ALTER TABLE public.community_messages 
ADD CONSTRAINT community_messages_content_check CHECK (char_length(content) BETWEEN 1 AND 5000);
