-- =============================================================================
-- Migration: Optimize RLS Performance
-- Resolves auth_rls_initplan and multiple_permissive_policies lints
-- =============================================================================

-- 1. Fix auth_rls_initplan (Wrap auth functions in SELECT for caching)

-- qna_questions
DROP POLICY IF EXISTS "Anyone can submit a question" ON public.qna_questions;
CREATE POLICY "Anyone can submit a question" ON public.qna_questions FOR INSERT WITH CHECK ((select auth.role()) IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Users can view their own questions" ON public.qna_questions;
CREATE POLICY "Users can view their own questions" ON public.qna_questions FOR SELECT USING ((select auth.uid()) = target_user_id);

DROP POLICY IF EXISTS "Users can update their own questions" ON public.qna_questions;
CREATE POLICY "Users can update their own questions" ON public.qna_questions FOR UPDATE USING ((select auth.uid()) = target_user_id);

DROP POLICY IF EXISTS "Users can delete their own questions" ON public.qna_questions;
CREATE POLICY "Users can delete their own questions" ON public.qna_questions FOR DELETE USING ((select auth.uid()) = target_user_id);

-- community_messages
DROP POLICY IF EXISTS "Authenticated users can send community messages" ON public.community_messages;
CREATE POLICY "Authenticated users can send community messages" ON public.community_messages FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own community messages" ON public.community_messages;
CREATE POLICY "Users can delete own community messages" ON public.community_messages FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- game_house (Only the ones not affected by merge below)
DROP POLICY IF EXISTS "Authenticated users can submit games" ON public.game_house;
CREATE POLICY "Authenticated users can submit games" ON public.game_house FOR INSERT WITH CHECK ((select auth.uid()) = submitted_by AND status = 'pending');

-- game_house_likes
DROP POLICY IF EXISTS "Game likes are visible when game is visible" ON public.game_house_likes;
CREATE POLICY "Game likes are visible when game is visible" ON public.game_house_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_house g
      WHERE g.id = game_id
        AND (
          g.status = 'approved'
          OR g.submitted_by = (select auth.uid())
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "Users can like approved games" ON public.game_house_likes;
CREATE POLICY "Users can like approved games" ON public.game_house_likes FOR INSERT
  WITH CHECK (
    (select auth.uid()) = user_id
    AND public.is_action_allowed('social')
    AND EXISTS (
      SELECT 1 FROM public.game_house g
      WHERE g.id = game_id
        AND g.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "Users can unlike their own game likes" ON public.game_house_likes;
CREATE POLICY "Users can unlike their own game likes" ON public.game_house_likes FOR DELETE
  USING (
    (select auth.uid()) = user_id
    AND public.is_action_allowed('social')
  );

-- game_house_comments (Only the ones not affected by merge below)
DROP POLICY IF EXISTS "Game comments are visible when game is visible" ON public.game_house_comments;
CREATE POLICY "Game comments are visible when game is visible" ON public.game_house_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_house g
      WHERE g.id = game_id
        AND (
          g.status = 'approved'
          OR g.submitted_by = (select auth.uid())
          OR public.is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own game comments" ON public.game_house_comments;
CREATE POLICY "Users can update own game comments" ON public.game_house_comments FOR UPDATE
  USING ((select auth.uid()) = user_id);

-- =============================================================================
-- 2. Fix multiple_permissive_policies (Combine redundant policies)
-- NOTE: We also apply the auth_rls_initplan fix to the combined policies.
-- =============================================================================

-- comments
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.comments;
CREATE POLICY "Users or admins can delete comments" ON public.comments FOR DELETE
  USING (((select auth.uid()) = user_id) OR public.is_admin());

-- posts
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Admins can delete any post" ON public.posts;
CREATE POLICY "Users or admins can delete posts" ON public.posts FOR DELETE
  USING (((select auth.uid()) = user_id) OR public.is_admin());

-- game_house
DROP POLICY IF EXISTS "Public can view approved games" ON public.game_house;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.game_house;
DROP POLICY IF EXISTS "Admins can view all submissions" ON public.game_house;
CREATE POLICY "Anyone can view approved, own, or all if admin" ON public.game_house FOR SELECT
  USING ((status = 'approved') OR ((select auth.uid()) = submitted_by) OR public.is_admin());

DROP POLICY IF EXISTS "Admins can update game status" ON public.game_house;
DROP POLICY IF EXISTS "Users can update their own games" ON public.game_house;
CREATE POLICY "Users or admins can update games" ON public.game_house FOR UPDATE
  USING (((select auth.uid()) = submitted_by) OR public.is_admin());

DROP POLICY IF EXISTS "Admins can delete games" ON public.game_house;
DROP POLICY IF EXISTS "Users can delete their own games" ON public.game_house;
CREATE POLICY "Users or admins can delete games" ON public.game_house FOR DELETE
  USING (((select auth.uid()) = submitted_by) OR public.is_admin());

-- game_house_comments
DROP POLICY IF EXISTS "Users can delete own game comments" ON public.game_house_comments;
DROP POLICY IF EXISTS "Admins can delete any game comment" ON public.game_house_comments;
CREATE POLICY "Users or admins can delete game comments" ON public.game_house_comments FOR DELETE
  USING (((select auth.uid()) = user_id) OR public.is_admin());
