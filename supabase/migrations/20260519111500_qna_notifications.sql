-- Update notifications type constraint to include 'qna_question'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('like', 'unlike', 'comment', 'uncomment', 'follow', 'unfollow', 'mention', 'game_submission', 'game_approved', 'game_rejected', 'game_like', 'game_comment', 'qna_question'));

-- Function to create notification when a new QnA question is inserted
CREATE OR REPLACE FUNCTION public.handle_new_qna_question()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a notification for the target user.
  -- Since the question is anonymous, we set actor_id = target_user_id (self notification)
  -- to satisfy the NOT NULL constraint on actor_id.
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.target_user_id, NEW.target_user_id, 'qna_question');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to fire the function
CREATE TRIGGER on_qna_question_created
  AFTER INSERT ON public.qna_questions
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_qna_question();
