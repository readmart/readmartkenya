-- ==========================================
-- Migration: Initialize Storage Buckets and Policies
-- Target: Storage (products, ebooks, agreements, site_assets, signed_agreements)
-- Description: Ensures all required buckets exist and have appropriate RLS policies.
-- ==========================================

-- 1. Create Buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('products', 'products', true),
  ('site_assets', 'site_assets', true),
  ('banners', 'banners', true),
  ('agreements', 'agreements', false),
  ('signed_agreements', 'signed_agreements', false),
  ('ebooks', 'ebooks', false),
  ('partnership_documents', 'partnership_documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2. Set up RLS for Storage Objects

-- Allow public read access to public buckets
CREATE POLICY "Public Read Access for products" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "Public Read Access for site_assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'site_assets');

CREATE POLICY "Public Read Access for banners" ON storage.objects
  FOR SELECT USING (bucket_id = 'banners');

-- Allow founders and admins full access to all buckets
CREATE POLICY "Admin Full Access to products" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'products' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  )
  WITH CHECK (
    bucket_id = 'products' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  );

CREATE POLICY "Admin Full Access to site_assets" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'site_assets' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  )
  WITH CHECK (
    bucket_id = 'site_assets' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  );

CREATE POLICY "Admin Full Access to banners" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'banners' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  )
  WITH CHECK (
    bucket_id = 'banners' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  );

CREATE POLICY "Admin Full Access to ebooks" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'ebooks' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  )
  WITH CHECK (
    bucket_id = 'ebooks' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  );

CREATE POLICY "Admin Full Access to agreements" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'agreements' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  )
  WITH CHECK (
    bucket_id = 'agreements' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  );

CREATE POLICY "Admin Full Access to signed_agreements" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'signed_agreements' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  )
  WITH CHECK (
    bucket_id = 'signed_agreements' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  );

CREATE POLICY "Admin Full Access to partnership_documents" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'partnership_documents' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  )
  WITH CHECK (
    bucket_id = 'partnership_documents' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  );

-- Allow Authors to upload their own product images and ebooks
CREATE POLICY "Author Upload Access to products" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'products' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author'))
  );

CREATE POLICY "Author Upload Access to ebooks" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ebooks' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author'))
  );

-- Allow users to read their own signed agreements
CREATE POLICY "User Read Own Signed Agreement" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'signed_agreements' AND 
    (auth.uid()::text = (storage.foldername(name))[1])
  );

-- Force schema reload
NOTIFY pgrst, 'reload schema';
