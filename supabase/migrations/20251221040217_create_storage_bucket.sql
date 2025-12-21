/*
  # Create Storage Bucket for Measurement Images

  1. New Storage Bucket
    - `measurement-images` - Store measurement photos captured by users
    
  2. Security
    - Enable RLS on storage.objects
    - Allow authenticated users to upload their own images
    - Allow authenticated users to read their own images
    - Images are associated with measurement points owned by the user
*/

-- Create storage bucket for measurement images
INSERT INTO storage.buckets (id, name, public)
VALUES ('measurement-images', 'measurement-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload measurement images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'measurement-images');

-- Allow authenticated users to read images
CREATE POLICY "Users can view measurement images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'measurement-images');

-- Allow authenticated users to delete their images
CREATE POLICY "Users can delete measurement images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'measurement-images');
