-- ==========================================
-- Migration: Fix Agreements RLS and Storage Policies
-- Description: Enables users to upload signed agreements and update their agreement status.
-- ==========================================

BEGIN;

-- 1. Fix public.agreements RLS
-- Allow users to update their own agreements (to sign them)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agreements' AND policyname = 'Users can update their own agreements') THEN
        CREATE POLICY "Users can update their own agreements" ON public.agreements
            FOR UPDATE TO authenticated
            USING (auth.uid() = partner_id)
            WITH CHECK (auth.uid() = partner_id);
    END IF;
END $$;

-- 2. Fix Storage Policies for signed_agreements bucket
-- 2.1 Allow users to upload signed agreements
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can upload signed agreements') THEN
        CREATE POLICY "Users can upload signed agreements" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (bucket_id = 'signed_agreements');
    END IF;
END $$;

-- 2.2 Robust SELECT policy for users to view their own signed agreements
-- We support both folder-based (auth.uid()/file.pdf) and owner-based checks
DROP POLICY IF EXISTS "Users view own signed agreements" ON storage.objects;
DROP POLICY IF EXISTS "User Read Own Signed Agreement" ON storage.objects;

CREATE POLICY "Users view own signed agreements" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'signed_agreements' AND (
            auth.uid() = owner OR 
            (auth.uid()::text = (storage.foldername(name))[1]) OR
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
        )
    );

-- 3. Ensure admins can manage everything in agreements
DROP POLICY IF EXISTS "Founders can manage all agreements" ON public.agreements;
CREATE POLICY "Admins manage all agreements" ON public.agreements
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));

COMMIT;
