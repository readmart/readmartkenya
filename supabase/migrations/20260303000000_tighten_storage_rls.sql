-- ==========================================
-- Migration: Tighten Storage RLS for Authors
-- Target: storage.objects (products, ebooks)
-- Description: Restricts authors to their own subfolders (authors/{user_id}/) to prevent unauthorized access.
-- ==========================================

BEGIN;

-- 1. Tighten Products Bucket Policies
DROP POLICY IF EXISTS "Authors manage own products" ON storage.objects;

CREATE POLICY "Authors manage own products" ON storage.objects 
    FOR ALL TO authenticated
    USING (
        bucket_id = 'products' AND 
        (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')) AND
        (storage.foldername(name))[1] = 'authors' AND 
        (storage.foldername(name))[2] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'products' AND 
        (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')) AND
        (storage.foldername(name))[1] = 'authors' AND 
        (storage.foldername(name))[2] = auth.uid()::text
    );

-- 2. Tighten Ebooks Bucket Policies
DROP POLICY IF EXISTS "Authors manage own ebooks" ON storage.objects;

CREATE POLICY "Authors manage own ebooks" ON storage.objects 
    FOR ALL TO authenticated
    USING (
        bucket_id = 'ebooks' AND 
        (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')) AND
        (storage.foldername(name))[1] = 'authors' AND 
        (storage.foldername(name))[2] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'ebooks' AND 
        (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')) AND
        (storage.foldername(name))[1] = 'authors' AND 
        (storage.foldername(name))[2] = auth.uid()::text
    );

-- 3. Notify schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
