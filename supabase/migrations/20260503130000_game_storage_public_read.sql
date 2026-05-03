-- Migration: Allow anyone to read game-house objects
-- We rely on the game_house table RLS to protect the file paths (UUIDs).
-- If a user knows the path (because they could read the approved game_house record), they can download it.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Anyone can read game HTML if they know the path') THEN
    CREATE POLICY "Anyone can read game HTML if they know the path" ON storage.objects FOR SELECT USING ( bucket_id = 'game-house' );
  END IF;
END $$;
