-- ==========================================
-- FINAL SCHEMA CONSOLIDATION & FIXES
-- Resolves all missing tables, columns, and buckets identified in logs
-- ==========================================

-- 1. Ensure audit_logs table exists
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    old_data JSONB DEFAULT '{}'::JSONB,
    new_data JSONB DEFAULT '{}'::JSONB,
    resource TEXT,      -- For backend compatibility
    payload JSONB DEFAULT '{}'::JSONB, -- For backend compatibility
    ip TEXT,           -- For backend compatibility
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'founder')
        )
    );

-- Authenticated can insert audit logs
DROP POLICY IF EXISTS "Authenticated can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');


-- 2. Ensure book_club_members exists
CREATE TABLE IF NOT EXISTS public.book_club_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'invited', 'banned')),
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(club_id, user_id)
);

-- Enable RLS for book_club_members
ALTER TABLE public.book_club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view club memberships" ON public.book_club_members;
CREATE POLICY "Members can view club memberships" ON public.book_club_members
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join clubs" ON public.book_club_members;
CREATE POLICY "Users can join clubs" ON public.book_club_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 3. Ensure fulfillment_ledger has all required columns
DO $$ 
BEGIN
    -- Create table if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger') THEN
        CREATE TABLE public.fulfillment_ledger (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            amount decimal(12,2) NOT NULL,
            payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'failed')),
            metadata jsonb DEFAULT '{}'::jsonb,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    END IF;

    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger' AND column_name = 'payout_status') THEN
        ALTER TABLE public.fulfillment_ledger ADD COLUMN payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'failed'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger' AND column_name = 'order_id') THEN
        ALTER TABLE public.fulfillment_ledger ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger' AND column_name = 'partner_id') THEN
        ALTER TABLE public.fulfillment_ledger ADD COLUMN partner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Fix RLS for fulfillment_ledger
ALTER TABLE public.fulfillment_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own ledger entries" ON public.fulfillment_ledger;
CREATE POLICY "Users can view their own ledger entries" ON public.fulfillment_ledger
    FOR SELECT USING (
        auth.uid() = partner_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
    );


-- 4. Ensure storage buckets exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('site_assets', 'site_assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for site_assets
DROP POLICY IF EXISTS "Public View Site Assets" ON storage.objects;
CREATE POLICY "Public View Site Assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'site_assets');

DROP POLICY IF EXISTS "Admins Manage Site Assets" ON storage.objects;
CREATE POLICY "Admins Manage Site Assets"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'site_assets' 
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'founder')
    )
)
WITH CHECK (
    bucket_id = 'site_assets' 
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'founder')
    )
);

-- Allow authors and partners to manage their own folders in site_assets
DROP POLICY IF EXISTS "Users Manage Own Site Assets" ON storage.objects;
CREATE POLICY "Users Manage Own Site Assets"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'site_assets' 
    AND (
        (storage.foldername(name))[1] = 'authors' AND (storage.foldername(name))[2] = auth.uid()::text
        OR
        (storage.foldername(name))[1] = 'partners' AND (storage.foldername(name))[2] = auth.uid()::text
    )
)
WITH CHECK (
    bucket_id = 'site_assets' 
    AND (
        (storage.foldername(name))[1] = 'authors' AND (storage.foldername(name))[2] = auth.uid()::text
        OR
        (storage.foldername(name))[1] = 'partners' AND (storage.foldername(name))[2] = auth.uid()::text
    )
);

-- Storage policies for banners
DROP POLICY IF EXISTS "Public View Banners" ON storage.objects;
CREATE POLICY "Public View Banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

DROP POLICY IF EXISTS "Admins Manage Banners" ON storage.objects;
CREATE POLICY "Admins Manage Banners"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'banners' 
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'founder')
    )
)
WITH CHECK (
    bucket_id = 'banners' 
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'founder')
    )
);


-- 5. Fix promos table schema drift
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promos') THEN
        CREATE TABLE public.promos (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            code text NOT NULL UNIQUE,
            discount_type text DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
            discount_value decimal(12,2) DEFAULT 0.00,
            min_order_amount decimal(12,2) DEFAULT 0.00,
            usage_limit integer DEFAULT 100,
            is_active boolean DEFAULT true,
            created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    END IF;

    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'promo_signature') THEN
        ALTER TABLE public.promos ADD COLUMN promo_signature text UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'predicted_impact') THEN
        ALTER TABLE public.promos ADD COLUMN predicted_impact decimal(12,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'start_at') THEN
        ALTER TABLE public.promos ADD COLUMN start_at timestamp with time zone DEFAULT now();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'expires_at') THEN
        ALTER TABLE public.promos ADD COLUMN expires_at timestamp with time zone;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'status') THEN
        ALTER TABLE public.promos ADD COLUMN status text DEFAULT 'draft';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'creator_id') THEN
        ALTER TABLE public.promos ADD COLUMN creator_id uuid REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'command_logic') THEN
        ALTER TABLE public.promos ADD COLUMN command_logic jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Enable RLS for promos
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage promos" ON public.promos;
CREATE POLICY "Admins can manage promos" ON public.promos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

DROP POLICY IF EXISTS "Public can view active promos" ON public.promos;
CREATE POLICY "Public can view active promos" ON public.promos
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));


-- 6. Fix Partnerships System
-- Ensure partnership_tiers exists with all required columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partnership_tiers') THEN
        CREATE TABLE public.partnership_tiers (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            benefits JSONB DEFAULT '[]'::JSONB,
            min_requirement TEXT,
            color_code TEXT DEFAULT '#808080',
            display_order INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    END IF;

    -- Add missing columns to partnership_tiers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'partnership_tiers' AND column_name = 'color_code') THEN
        ALTER TABLE public.partnership_tiers ADD COLUMN color_code TEXT DEFAULT '#808080';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'partnership_tiers' AND column_name = 'display_order') THEN
        ALTER TABLE public.partnership_tiers ADD COLUMN display_order INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'partnership_tiers' AND column_name = 'is_active') THEN
        ALTER TABLE public.partnership_tiers ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'partnership_tiers' AND column_name = 'updated_at') THEN
        ALTER TABLE public.partnership_tiers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'partnership_tiers' AND column_name = 'min_requirement') THEN
        ALTER TABLE public.partnership_tiers ADD COLUMN min_requirement TEXT;
    END IF;
END $$;

-- Seed default tiers if none exist
INSERT INTO public.partnership_tiers (name, description, benefits, color_code, display_order)
SELECT 'Bronze', 'Standard partnership level', '[]', '#CD7F32', 1
WHERE NOT EXISTS (SELECT 1 FROM public.partnership_tiers WHERE name = 'Bronze');

INSERT INTO public.partnership_tiers (name, description, benefits, color_code, display_order)
SELECT 'Silver', 'Intermediate level', '[]', '#C0C0C0', 2
WHERE NOT EXISTS (SELECT 1 FROM public.partnership_tiers WHERE name = 'Silver');

INSERT INTO public.partnership_tiers (name, description, benefits, color_code, display_order)
SELECT 'Gold', 'Top-tier partnership', '[]', '#FFD700', 3
WHERE NOT EXISTS (SELECT 1 FROM public.partnership_tiers WHERE name = 'Gold');

-- Ensure partnership_applications has tier_id relationship
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'partnership_applications' AND column_name = 'tier_id') THEN
        ALTER TABLE public.partnership_applications ADD COLUMN tier_id uuid REFERENCES public.partnership_tiers(id);
    END IF;
END $$;


-- 7. Ensure orders table has all financial columns
DO $$ 
BEGIN
    -- Add missing financial columns to orders if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_amount') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'subtotal_amount') THEN
        ALTER TABLE public.orders ADD COLUMN subtotal_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.orders ADD COLUMN tax_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_amount') THEN
        ALTER TABLE public.orders ADD COLUMN total_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE public.orders ADD COLUMN payment_method text DEFAULT 'm-pesa';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_zone_id') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_zone_id uuid REFERENCES public.shipping_zones(id);
    END IF;
END $$;


-- 8. Finalize PostgREST reload
NOTIFY pgrst, 'reload schema';
