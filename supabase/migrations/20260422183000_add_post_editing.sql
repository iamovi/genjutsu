-- Add edited timestamp for posts
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Enforce ban scopes for direct post updates as well.
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  USING ((select auth.uid()) = user_id AND public.is_action_allowed('post'));

-- edit_post: owner-only edits within 24h, respects ban scopes, sets edited_at
CREATE OR REPLACE FUNCTION public.edit_post(
  p_post_id UUID,
  p_content TEXT,
  p_code TEXT DEFAULT '',
  p_tags TEXT[] DEFAULT '{}',
  p_media_url TEXT DEFAULT '',
  p_is_readme BOOLEAN DEFAULT false,
  p_code_language TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_post public.posts%ROWTYPE;
  v_banned_until TIMESTAMPTZ;
  v_ban_permanent BOOLEAN := false;
  v_edited_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated', 'message', 'You must be signed in');
  END IF;

  SELECT *
  INTO v_post
  FROM public.posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'post_not_found', 'message', 'Post not found');
  END IF;

  IF v_post.user_id <> v_user_id THEN
    RETURN jsonb_build_object('error', 'not_authorized', 'message', 'You can only edit your own posts');
  END IF;

  IF v_post.created_at < now() - INTERVAL '24 hours' THEN
    RETURN jsonb_build_object('error', 'expired', 'message', 'This post has expired');
  END IF;

  SELECT banned_until, ban_permanent
  INTO v_banned_until, v_ban_permanent
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF NOT public.is_action_allowed('post') THEN
    RETURN jsonb_build_object(
      'error', 'banned',
      'message', CASE
        WHEN v_ban_permanent THEN 'You are permanently banned from posting'
        ELSE 'You are temporarily banned from posting'
      END,
      'banned_until', v_banned_until,
      'ban_permanent', v_ban_permanent
    );
  END IF;

  IF v_post.content = p_content
     AND COALESCE(v_post.code, '') = COALESCE(p_code, '')
     AND COALESCE(v_post.tags, '{}'::TEXT[]) = COALESCE(p_tags, '{}'::TEXT[])
     AND COALESCE(v_post.media_url, '') = COALESCE(p_media_url, '')
     AND COALESCE(v_post.is_readme, false) = COALESCE(p_is_readme, false)
     AND COALESCE(v_post.code_language, '') = COALESCE(p_code_language, '') THEN
    RETURN jsonb_build_object('error', 'no_changes', 'message', 'No changes detected');
  END IF;

  UPDATE public.posts
  SET
    content = p_content,
    code = p_code,
    tags = p_tags,
    media_url = p_media_url,
    is_readme = p_is_readme,
    code_language = p_code_language,
    edited_at = now()
  WHERE id = p_post_id
  RETURNING edited_at INTO v_edited_at;

  RETURN jsonb_build_object(
    'success', true,
    'post_id', p_post_id,
    'edited_at', v_edited_at
  );
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
