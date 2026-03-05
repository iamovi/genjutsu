-- Add is_readme column to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_readme BOOLEAN DEFAULT false;
