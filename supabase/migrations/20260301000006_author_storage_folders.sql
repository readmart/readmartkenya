-- ==========================================
-- Migration: Author Storage Folder RLS Policies
-- Target: Storage (products, ebooks)
-- Description: Restricts authors to their own folders within products and ebooks buckets.
-- ==========================================

-- 1. Remove existing overly permissive policies for authors
DROP POLICY IF EXISTS "Author Upload Access to products" ON storage.objects;
DROP POLICY IF EXISTS "Author Upload Access to ebooks" ON storage.objects;

-- 2. New policies for 'products' bucket (Public)
-- Path: authors/{user_id}/{filename}

CREATE POLICY "Author Upload Own Product Images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'products' AND 
    (storage.foldername(name))[1] = 'authors' AND 
    (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Author Update Own Product Images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'products' AND 
    (storage.foldername(name))[1] = 'authors' AND 
    (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Author Delete Own Product Images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'products' AND 
    (storage.foldername(name))[1] = 'authors' AND 
    (storage.foldername(name))[2] = auth.uid()::text
  );

-- 3. New policies for 'ebooks' bucket (Private)
-- Path: authors/{user_id}/{filename}

CREATE POLICY "Author Upload Own Ebooks" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ebooks' AND 
    (storage.foldername(name))[1] = 'authors' AND 
    (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Author Read Own Ebooks" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ebooks' AND 
    (storage.foldername(name))[1] = 'authors' AND 
    (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Author Update Own Ebooks" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ebooks' AND 
    (storage.foldername(name))[1] = 'authors' AND 
    (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Author Delete Own Ebooks" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ebooks' AND 
    (storage.foldername(name))[1] = 'authors' AND 
    (storage.foldername(name))[2] = auth.uid()::text
  );

-- Force schema reload
NOTIFY pgrst, 'reload schema';
