ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url    TEXT,
  ADD COLUMN IF NOT EXISTS avatar_preset TEXT;

-- Create the private avatars bucket (5 MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
