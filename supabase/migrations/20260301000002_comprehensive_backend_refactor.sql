
-- ==========================================
-- Migration: Comprehensive Backend Refactor
-- Description: Fixes storage RLS, missing columns, and ensures data integrity.
-- ==========================================

BEGIN;

-- 1. Ensure Critical Tables Exist
CREATE TABLE IF NOT EXISTS public.newsletter_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES public.newsletter_subscriptions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ensure Promos Columns Exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'command_logic') THEN
        ALTER TABLE public.promos ADD COLUMN command_logic jsonb DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'promo_signature') THEN
        ALTER TABLE public.promos ADD COLUMN promo_signature TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'status') THEN
        ALTER TABLE public.promos ADD COLUMN status TEXT DEFAULT 'draft';
    END IF;
END $$;

-- 3. Fix Storage Buckets and Policies
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('products', 'products', true),
  ('ebooks', 'ebooks', false),
  ('banners', 'banners', true),
  ('site_assets', 'site_assets', true),
  ('partnership_documents', 'partnership_documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 3.1 Robust Storage Policies
-- DROP existing to avoid conflicts
DROP POLICY IF EXISTS "Admins manage products" ON storage.objects;
DROP POLICY IF EXISTS "Authors manage own products" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access Products" ON storage.objects;

CREATE POLICY "Public Read Access Products" ON storage.objects FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "Admins manage products" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'products' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))))
    WITH CHECK (bucket_id = 'products' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));

CREATE POLICY "Authors manage own products" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'products' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')))
    WITH CHECK (bucket_id = 'products' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')));

-- 3.2 Site Assets Policies
DROP POLICY IF EXISTS "Admins manage site_assets" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access Site Assets" ON storage.objects;

CREATE POLICY "Public Read Access Site Assets" ON storage.objects FOR SELECT USING (bucket_id = 'site_assets');

CREATE POLICY "Admins manage site_assets" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'site_assets' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder', 'author'))))
    WITH CHECK (bucket_id = 'site_assets' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder', 'author'))));

-- 4. RLS Policies for Newsletter Logs
ALTER TABLE public.newsletter_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view newsletter logs" ON public.newsletter_logs;
CREATE POLICY "Admins can view newsletter logs" ON public.newsletter_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'founder')
        )
    );

DROP POLICY IF EXISTS "Anyone can insert newsletter logs" ON public.newsletter_logs;
CREATE POLICY "Anyone can insert newsletter logs" ON public.newsletter_logs
    FOR INSERT WITH CHECK (true);

-- 5. Finalize Schema Cache
NOTIFY pgrst, 'reload schema';

COMMIT;
