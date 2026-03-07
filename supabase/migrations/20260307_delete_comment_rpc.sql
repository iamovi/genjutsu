-- delete_comment RPC: Server-side comment deletion with SECURITY DEFINER
-- Bypasses RLS and handles authorization explicitly.
-- Allows comment owners and admins to delete comments.

CREATE OR REPLACE FUNCTION public.delete_comment(p_comment_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_comment_owner UUID;
  v_post_id UUID;
  v_post_owner UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  -- Get comment metadata
  SELECT user_id, post_id INTO v_comment_owner, v_post_id
  FROM public.comments
  WHERE id = p_comment_id;

  IF v_comment_owner IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found', 'message', 'Comment not found');
  END IF;

  -- Get post owner
  SELECT user_id INTO v_post_owner
  FROM public.posts
  WHERE id = v_post_id;

  -- Check authorization: must be comment owner, post owner, or admin
  IF v_comment_owner != v_user_id AND v_post_owner != v_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('error', 'not_authorized', 'message', 'You can only delete your own comments (or echoes on your posts)');
  END IF;

  DELETE FROM public.comments WHERE id = p_comment_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
