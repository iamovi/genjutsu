-- =============================================================================
-- genjutsu — init.sql
-- Consolidated database setup for a fresh Supabase project.
-- Run this ONCE in the Supabase SQL Editor to set up the entire database.
--
-- AFTER running this, you must also:
--   1. Set your .env file with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
--   2. Store your service_role key in Vault (for auto storage cleanup):
--      SELECT vault.create_secret('supabase_service_role_key', 'YOUR_KEY');
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- =============================================================================
-- TABLES
-- =============================================================================

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  social_links JSONB DEFAULT '{}'::jsonb,
  fav_song JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  code TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  tags TEXT[] DEFAULT '{}',
  is_readme BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Likes
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Bookmarks
CREATE TABLE public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Follows
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Messages (Whispers)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING ((select auth.uid()) = user_id);

-- Posts
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create their own posts"
  ON public.posts FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own posts"
  ON public.posts FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own posts"
  ON public.posts FOR DELETE USING ((select auth.uid()) = user_id);

-- Likes
CREATE POLICY "Likes are viewable by everyone"
  ON public.likes FOR SELECT USING (true);
CREATE POLICY "Users can like posts"
  ON public.likes FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can unlike posts"
  ON public.likes FOR DELETE USING ((select auth.uid()) = user_id);

-- Bookmarks
CREATE POLICY "Users can view their own bookmarks"
  ON public.bookmarks FOR SELECT USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can bookmark posts"
  ON public.bookmarks FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can remove bookmarks"
  ON public.bookmarks FOR DELETE USING ((select auth.uid()) = user_id);

-- Follows
CREATE POLICY "Follows are viewable by everyone"
  ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow"
  ON public.follows FOR INSERT WITH CHECK ((select auth.uid()) = follower_id);
CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE USING ((select auth.uid()) = follower_id);

-- Comments
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can create their own comments"
  ON public.comments FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Users can update their own comments"
  ON public.comments FOR UPDATE USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE USING ((select auth.uid()) = user_id);

-- Messages
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT USING ((select auth.uid()) = sender_id OR (select auth.uid()) = receiver_id);
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT WITH CHECK ((select auth.uid()) = sender_id);


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup (supports email/password + Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    LOWER(REPLACE(COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    ), ' ', '')),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture',
      ''
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;


-- =============================================================================
-- STORAGE BUCKETS & POLICIES
-- =============================================================================

-- Post media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Banners bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- post-media policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access') THEN
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'post-media' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload') THEN
    CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'post-media' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete post media') THEN
    CREATE POLICY "Users can delete post media" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'post-media' );
  END IF;
END $$;

-- avatars policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access for Avatars') THEN
    CREATE POLICY "Public Access for Avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload avatars') THEN
    CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own avatars') THEN
    CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text );
  END IF;
END $$;

-- banners policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access for Banners') THEN
    CREATE POLICY "Public Access for Banners" ON storage.objects FOR SELECT USING ( bucket_id = 'banners' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload banners') THEN
    CREATE POLICY "Authenticated users can upload banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'banners' );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own banners') THEN
    CREATE POLICY "Users can delete their own banners" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'banners' AND (storage.foldername(name))[1] = auth.uid()::text );
  END IF;
END $$;


-- =============================================================================
-- 24-HOUR EXPIRATION (CRON JOBS)
-- =============================================================================

-- Delete expired posts + clean up storage files via pg_net
-- REQUIRES: vault secret 'supabase_service_role_key' to be set
CREATE OR REPLACE FUNCTION public.delete_expired_posts()
RETURNS void AS $$
DECLARE
  expired_post RECORD;
  file_path TEXT;
  service_key TEXT;
BEGIN
  -- Get the service role key from Supabase Vault
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  -- If we have the key, clean up storage files first
  IF service_key IS NOT NULL THEN
    FOR expired_post IN
      SELECT id, media_url FROM public.posts
      WHERE created_at < now() - INTERVAL '24 hours'
        AND media_url IS NOT NULL
        AND media_url <> ''
        AND media_url LIKE '%post-media%'
    LOOP
      file_path := split_part(expired_post.media_url, 'post-media/', 2);

      IF file_path IS NOT NULL AND file_path <> '' THEN
        PERFORM net.http_delete(
          url := 'https://scvikrxfxijqoedfryvx.supabase.co/storage/v1/object/post-media/' || file_path,
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || service_key
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- Delete expired posts (CASCADE handles comments, likes, bookmarks)
  DELETE FROM public.posts
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, vault, extensions;

-- Delete expired whispers
CREATE OR REPLACE FUNCTION public.delete_expired_whispers()
RETURNS void AS $$
BEGIN
  DELETE FROM public.messages
  WHERE created_at < now() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Schedule cleanups (every hour)
SELECT cron.schedule('0 * * * *', 'SELECT public.delete_expired_posts()');
SELECT cron.schedule('5 * * * *', 'SELECT public.delete_expired_whispers()');
