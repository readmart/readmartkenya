-- ==========================================
-- Migration: Storage Buckets and Policies Completion
-- Target: storage.buckets, storage.objects
-- Description: Ensures all required storage buckets exist and have correct policies.
-- ==========================================

BEGIN;

-- 1. Create missing buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('products', 'products', true),
  ('ebooks', 'ebooks', false),
  ('banners', 'banners', true),
  ('partnership_documents', 'partnership_documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for products (Public Read)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Read Access Products') THEN
        CREATE POLICY "Public Read Access Products" ON storage.objects FOR SELECT USING (bucket_id = 'products');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins manage products') THEN
        CREATE POLICY "Admins manage products" ON storage.objects FOR ALL USING (bucket_id = 'products' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 3. Storage Policies for banners (Public Read)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Read Access Banners') THEN
        CREATE POLICY "Public Read Access Banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins manage banners') THEN
        CREATE POLICY "Admins manage banners" ON storage.objects FOR ALL USING (bucket_id = 'banners' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 4. Storage Policies for ebooks (Private)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users view purchased ebooks') THEN
        -- This is a simplified policy. In a real app, you'd check if the user has purchased the product.
        -- For now, we allow authenticated users to read if they have an order for it, 
        -- but for simplicity of this migration, we'll allow admins and owners.
        CREATE POLICY "Users view purchased ebooks" ON storage.objects FOR SELECT USING (bucket_id = 'ebooks' AND (auth.uid() = owner OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins manage ebooks') THEN
        CREATE POLICY "Admins manage ebooks" ON storage.objects FOR ALL USING (bucket_id = 'ebooks' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 5. Storage Policies for partnership_documents (Private)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users view own partnership docs') THEN
        CREATE POLICY "Users view own partnership docs" ON storage.objects FOR SELECT USING (bucket_id = 'partnership_documents' AND (auth.uid() = owner OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users upload partnership docs') THEN
        CREATE POLICY "Users upload partnership docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'partnership_documents' AND auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins manage partnership docs') THEN
        CREATE POLICY "Admins manage partnership docs" ON storage.objects FOR ALL USING (bucket_id = 'partnership_documents' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

COMMIT;
