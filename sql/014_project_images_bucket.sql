-- 014: Create project-images storage bucket with RLS policies
-- Run in Supabase SQL Editor

-- Create the bucket (public so images can be displayed via public URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-images',
  'project-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload project images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'project-images');

-- Allow public read
CREATE POLICY "Public can view project images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'project-images');

-- Allow authenticated users to delete project images
CREATE POLICY "Authenticated users can delete project images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'project-images');
