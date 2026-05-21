-- =============================================================================
-- Migration: Fix Supabase Security Lints
-- Addresses warnings reported by Supabase Security Advisor
-- =============================================================================

-- 1. Function Search Path Mutable
ALTER FUNCTION public.prevent_direct_username_change() SET search_path = public;
ALTER FUNCTION public.handle_new_qna_question() SET search_path = public;

-- 2. RLS Policy Always True
DROP POLICY IF EXISTS "Anyone can submit a question" ON public.qna_questions;
CREATE POLICY "Anyone can submit a question"
  ON public.qna_questions FOR INSERT
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- 3. Public Bucket Allows Listing
DROP POLICY IF EXISTS "Public Access for Avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for Banners" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for Profile Album" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for Whisper Media" ON storage.objects;

-- 4. anon_security_definer_function_executable & authenticated_security_definer_function_executable

-- Revoke EXECUTE from internal triggers and cron helpers entirely
REVOKE EXECUTE ON FUNCTION public.delete_expired_action_logs() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_expired_follow_notifications() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_expired_posts() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_expired_whispers() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_profile_album_limit() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_mentions(text, uuid, uuid, uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_qna_question() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_new_game(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment_mention() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_follow() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_game_comment() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_game_like() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_like() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_post_mention() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_uncomment() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_unfollow() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_unlike() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user_game_status(uuid, uuid, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_push_notification() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_whisper_push_notification() FROM public, anon, authenticated;

-- For RPCs that require authentication, revoke from anon and public, then explicitly grant to authenticated
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid, integer, text, text[], boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, integer, text, text[], boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_delete_post(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_post(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_unban_user(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.change_username(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.change_username(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_comment(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_comment(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_game_comment(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_game_comment(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_post(text, text, text[], text, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_post(text, text, text[], text, boolean, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_post(text, text, text[], text, boolean, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_post(text, text, text[], text, boolean, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_comment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_comment(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_game_comment(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_game_comment(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.edit_post(uuid, text, text, text[], text, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.edit_post(uuid, text, text, text[], text, boolean, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_username_cooldown() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_username_cooldown() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_game_play_count(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_game_play_count(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_action_allowed(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_action_allowed(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.record_post_view(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_post_view(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(text, text, text) TO authenticated;
