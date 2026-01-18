-- ==========================================
-- Migration: Fix Founder Dashboard Tables
-- Target: promos, shipping_zones
-- ==========================================

BEGIN;

-- 1. Promos Table
CREATE TABLE IF NOT EXISTS public.promos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text NOT NULL UNIQUE,
    discount_type text CHECK (discount_type IN ('percentage', 'fixed')) NOT NULL,
    discount_value decimal(12,2) NOT NULL,
    min_order_amount decimal(12,2) DEFAULT 0.00,
    usage_count integer DEFAULT 0,
    usage_limit integer DEFAULT 100,
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist for promos (in case table existed but was incomplete)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promos' AND column_name='discount_type') THEN
        ALTER TABLE public.promos ADD COLUMN discount_type text CHECK (discount_type IN ('percentage', 'fixed')) NOT NULL DEFAULT 'percentage';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promos' AND column_name='usage_count') THEN
        ALTER TABLE public.promos ADD COLUMN usage_count integer DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='promos' AND column_name='usage_limit') THEN
        ALTER TABLE public.promos ADD COLUMN usage_limit integer DEFAULT 100;
    END IF;
END $$;

-- 2. Shipping Zones Table
CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    base_rate decimal(12,2) NOT NULL DEFAULT 0.00,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Handle renaming or adding base_rate if it was 'rate'
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='rate') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='base_rate') THEN
        ALTER TABLE public.shipping_zones RENAME COLUMN rate TO base_rate;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='base_rate') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN base_rate decimal(12,2) NOT NULL DEFAULT 0.00;
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Promos
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Promos are viewable by admins" ON public.promos;
    DROP POLICY IF EXISTS "Public can view active promos" ON public.promos;
END $$;

CREATE POLICY "Promos are viewable by admins" ON public.promos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

CREATE POLICY "Public can view active promos" ON public.promos
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- 5. Policies for Shipping Zones
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Shipping zones are viewable by everyone" ON public.shipping_zones;
    DROP POLICY IF EXISTS "Admins can manage shipping zones" ON public.shipping_zones;
END $$;

CREATE POLICY "Shipping zones are viewable by everyone" ON public.shipping_zones
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage shipping zones" ON public.shipping_zones
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

COMMIT;
