-- =============================================================================
-- Add is_ai_reply to community_messages
-- Run this in Supabase SQL Editor to support the UI distinguishing AI replies.
-- =============================================================================

ALTER TABLE public.community_messages 
ADD COLUMN is_ai_reply BOOLEAN DEFAULT FALSE NOT NULL;
