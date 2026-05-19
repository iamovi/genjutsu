-- =============================================================================
-- QNA QUESTIONS TABLE
-- Anonymous questions that anyone can submit to a user's profile.
-- =============================================================================

CREATE TABLE public.qna_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL CHECK (char_length(question_text) BETWEEN 1 AND 500),
  is_answered BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qna_questions_target_user
  ON public.qna_questions (target_user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.qna_questions ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous/unauthenticated) can INSERT a question
CREATE POLICY "Anyone can submit a question"
  ON public.qna_questions FOR INSERT
  WITH CHECK (true);

-- Only the target user can read their own questions
CREATE POLICY "Users can view their own questions"
  ON public.qna_questions FOR SELECT
  USING (auth.uid() = target_user_id);

-- Only the target user can update (mark as answered)
CREATE POLICY "Users can update their own questions"
  ON public.qna_questions FOR UPDATE
  USING (auth.uid() = target_user_id);

-- Only the target user can delete their questions
CREATE POLICY "Users can delete their own questions"
  ON public.qna_questions FOR DELETE
  USING (auth.uid() = target_user_id);
