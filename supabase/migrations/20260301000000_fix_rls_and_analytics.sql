-- ==========================================
-- Migration: Fix RLS Policies, Analytics and Missing Columns
-- Target: orders, order_items, profiles, products, storage.objects
-- Description: Adds admin/founder policies, ensures critical columns exist, and enables Realtime.
-- ==========================================

BEGIN;

-- 1. Ensure Critical Columns Exist in Products
DO $$ 
BEGIN
    -- Type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'type') THEN
        ALTER TABLE public.products ADD COLUMN type TEXT DEFAULT 'physical' CHECK (type IN ('physical', 'ebook'));
    END IF;

    -- Weight & Volume
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'weight') THEN
        ALTER TABLE public.products ADD COLUMN weight decimal(12,3) DEFAULT 0.500;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'volume') THEN
        ALTER TABLE public.products ADD COLUMN volume decimal(12,6) DEFAULT 0.001;
    END IF;

    -- Author ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'author_id') THEN
        ALTER TABLE public.products ADD COLUMN author_id uuid REFERENCES public.profiles(id);
    END IF;

    -- Digital Fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_ebook') THEN
        ALTER TABLE public.products ADD COLUMN is_ebook boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'ebook_url') THEN
        ALTER TABLE public.products ADD COLUMN ebook_url text;
    END IF;

    -- Image URL (Fix for possible missing column)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'image_url') THEN
        ALTER TABLE public.products ADD COLUMN image_url text;
    END IF;
END $$;

-- 2. Profiles: Ensure admins can see all profiles for analytics
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admins can view all profiles') THEN
        CREATE POLICY "Admins can view all profiles" ON public.profiles
            FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 3. Orders: Add admin/founder policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Admins can view all orders') THEN
        CREATE POLICY "Admins can view all orders" ON public.orders
            FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Admins can manage all orders') THEN
        CREATE POLICY "Admins can manage all orders" ON public.orders
            FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 4. Order Items: Add admin/founder policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Admins can view all order items') THEN
        CREATE POLICY "Admins can view all order items" ON public.order_items
            FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Admins can manage all order items') THEN
        CREATE POLICY "Admins can manage all order items" ON public.order_items
            FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 5. Fix Storage Policies
DROP POLICY IF EXISTS "Admins manage products" ON storage.objects;
DROP POLICY IF EXISTS "Admin Full Access to products" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access Products" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access for products" ON storage.objects;
DROP POLICY IF EXISTS "Author Upload Access to products" ON storage.objects;

DROP POLICY IF EXISTS "Admins manage ebooks" ON storage.objects;
DROP POLICY IF EXISTS "Admin Full Access to ebooks" ON storage.objects;
DROP POLICY IF EXISTS "Author Upload Access to ebooks" ON storage.objects;
DROP POLICY IF EXISTS "Users view purchased ebooks" ON storage.objects;

DROP POLICY IF EXISTS "Admins manage banners" ON storage.objects;
DROP POLICY IF EXISTS "Admin Full Access to banners" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access Banners" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access for banners" ON storage.objects;

DROP POLICY IF EXISTS "Admin Full Access to site_assets" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access for site_assets" ON storage.objects;

DROP POLICY IF EXISTS "Admin Full Access to agreements" ON storage.objects;
DROP POLICY IF EXISTS "Admin Full Access to signed_agreements" ON storage.objects;
DROP POLICY IF EXISTS "Admin Full Access to partnership_documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage partnership docs" ON storage.objects;
DROP POLICY IF EXISTS "Users view own partnership docs" ON storage.objects;
DROP POLICY IF EXISTS "Users upload partnership docs" ON storage.objects;
DROP POLICY IF EXISTS "User Read Own Signed Agreement" ON storage.objects;

-- 5.1 Public Read Policies
CREATE POLICY "Public Read Access Products" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Public Read Access Banners" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Public Read Access Site Assets" ON storage.objects FOR SELECT USING (bucket_id = 'site_assets');

-- 5.2 Admin/Founder Full Access (All buckets)
CREATE POLICY "Admins manage products" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'products' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))))
    WITH CHECK (bucket_id = 'products' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));

CREATE POLICY "Admins manage ebooks" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'ebooks' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))))
    WITH CHECK (bucket_id = 'ebooks' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));

CREATE POLICY "Admins manage banners" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'banners' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))))
    WITH CHECK (bucket_id = 'banners' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));

CREATE POLICY "Admins manage site_assets" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'site_assets' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))))
    WITH CHECK (bucket_id = 'site_assets' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));

CREATE POLICY "Admins manage agreements" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id IN ('agreements', 'signed_agreements') AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))))
    WITH CHECK (bucket_id IN ('agreements', 'signed_agreements') AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));

CREATE POLICY "Admins manage partnership docs" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'partnership_documents' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))))
    WITH CHECK (bucket_id = 'partnership_documents' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));

-- 5.3 Author Policies (Products & Ebooks)
CREATE POLICY "Authors manage own products" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'products' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')))
    WITH CHECK (bucket_id = 'products' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')));

CREATE POLICY "Authors manage own ebooks" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'ebooks' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')))
    WITH CHECK (bucket_id = 'ebooks' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'author')));

-- 5.4 User Private Access
CREATE POLICY "Users view purchased ebooks" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ebooks' AND (
        (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))) OR
        (owner = auth.uid())
    ));

CREATE POLICY "Users view own partnership docs" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'partnership_documents' AND (owner = auth.uid()));

CREATE POLICY "Users upload partnership docs" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'partnership_documents');

CREATE POLICY "Users view own signed agreements" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'signed_agreements' AND (owner = auth.uid()));

-- 6. Promos: Ensure Critical Columns Exist
DO $$ 
BEGIN
    -- Promo Signature
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'promo_signature') THEN
        ALTER TABLE public.promos ADD COLUMN promo_signature TEXT;
    END IF;

    -- Predicted Impact
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'predicted_impact') THEN
        ALTER TABLE public.promos ADD COLUMN predicted_impact decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Start At
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'start_at') THEN
        ALTER TABLE public.promos ADD COLUMN start_at timestamp with time zone DEFAULT now();
    END IF;

    -- Command Logic (JSONB)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'command_logic') THEN
        ALTER TABLE public.promos ADD COLUMN command_logic jsonb DEFAULT '{}'::jsonb;
    END IF;

    -- Creator ID
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'creator_id') THEN
        ALTER TABLE public.promos ADD COLUMN creator_id uuid REFERENCES public.profiles(id);
    END IF;

    -- Status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'status') THEN
        ALTER TABLE public.promos ADD COLUMN status text DEFAULT 'draft';
    END IF;
END $$;

-- 7. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.promos;

COMMIT;
