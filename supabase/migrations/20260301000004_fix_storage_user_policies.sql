-- ==========================================
-- Migration: Fix Storage Policies for Users
-- Target: Storage (partnership_documents, signed_agreements)
-- Description: Ensures users can upload their own documents.
-- ==========================================

-- 1. Allow users to upload to partnership_documents
-- We use the naming convention proof_{user_id}_{timestamp}.ext
CREATE POLICY "User Upload Own Partnership Documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'partnership_documents' AND 
    (storage.foldername(name))[1] IS NULL -- Files are in the root
    AND (name LIKE 'proof_' || auth.uid() || '_%')
  );

-- 2. Allow users to upload to signed_agreements
-- The path is {user_id}/signed_{user_id}_{timestamp}.pdf
CREATE POLICY "User Upload Own Signed Agreement" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'signed_agreements' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Allow users to delete their own partnership documents (in case they want to re-upload before submission)
CREATE POLICY "User Delete Own Partnership Documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'partnership_documents' AND 
    (name LIKE 'proof_' || auth.uid() || '_%')
  );

-- 4. Allow users to upload their own avatars/profile images to site_assets
CREATE POLICY "User Upload Own Avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'site_assets' AND 
    (
      (storage.foldername(name))[1] = 'authors' AND (storage.foldername(name))[2] = auth.uid()::text
      OR 
      (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- 5. Allow users to update/delete their own avatars
CREATE POLICY "User Update Own Avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'site_assets' AND 
    (
      (storage.foldername(name))[1] = 'authors' AND (storage.foldername(name))[2] = auth.uid()::text
      OR 
      (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text
    )
  );

CREATE POLICY "User Delete Own Avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'site_assets' AND 
    (
      (storage.foldername(name))[1] = 'authors' AND (storage.foldername(name))[2] = auth.uid()::text
      OR 
      (storage.foldername(name))[1] = 'avatars' AND (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- Force schema reload
NOTIFY pgrst, 'reload schema';
