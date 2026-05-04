-- Add draft_data column to game_house table to store pending edits
ALTER TABLE public.game_house ADD COLUMN draft_data jsonb DEFAULT NULL;

-- Allow creators to update their own games (needed for setting draft_data)
CREATE POLICY "Users can update their own games"
  ON public.game_house
  FOR UPDATE
  USING (auth.uid() = submitted_by);

-- Allow creators to delete their own games
CREATE POLICY "Users can delete their own games"
  ON public.game_house
  FOR DELETE
  USING (auth.uid() = submitted_by);
