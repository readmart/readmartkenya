-- ==========================================
-- Migration: Emergency Backend Audit Fix
-- Description: Addresses issues identified during the system audit:
-- 1. Creates missing newsletter_logs table.
-- 2. Fixes promos table schema drift and reloads schema.
-- 3. Fixes order_items relationship for API joins.
-- 4. Corrects Storage RLS for product uploads.
-- ==========================================

BEGIN;

-- 1. Create missing newsletter_logs table
CREATE TABLE IF NOT EXISTS public.newsletter_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES public.newsletter_subscriptions(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'subscription_confirmed', 'email_sent', 'link_clicked'
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on newsletter_logs
ALTER TABLE public.newsletter_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_logs' AND policyname = 'Admins can view newsletter logs') THEN
        CREATE POLICY "Admins can view newsletter logs" ON public.newsletter_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- Anyone can insert logs (for tracking)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'newsletter_logs' AND policyname = 'Anyone can insert newsletter logs') THEN
        CREATE POLICY "Anyone can insert newsletter logs" ON public.newsletter_logs
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 1.1 Create missing audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_data JSONB DEFAULT '{}'::JSONB,
    new_data JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view audit logs
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Admins can view audit logs') THEN
        CREATE POLICY "Admins can view audit logs" ON public.audit_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- System/Authenticated can insert audit logs
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Authenticated can insert audit logs') THEN
        CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- 2. Fix promos table schema drift
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'promos' AND column_name = 'command_logic') THEN
        ALTER TABLE public.promos ADD COLUMN command_logic jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2.1 Fix site_settings table schema drift
DO $$ 
BEGIN
    -- Core settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'tax_rate') THEN
        ALTER TABLE public.site_settings ADD COLUMN tax_rate decimal(5,2) DEFAULT 16.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'default_currency') THEN
        ALTER TABLE public.site_settings ADD COLUMN default_currency text DEFAULT 'KES';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'maintenance_mode') THEN
        ALTER TABLE public.site_settings ADD COLUMN maintenance_mode boolean DEFAULT false;
    END IF;
    
    -- Announcements
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'global_announcement') THEN
        ALTER TABLE public.site_settings ADD COLUMN global_announcement text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'announcement_active') THEN
        ALTER TABLE public.site_settings ADD COLUMN announcement_active boolean DEFAULT false;
    END IF;
    
    -- Membership
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'membership_wall_active') THEN
        ALTER TABLE public.site_settings ADD COLUMN membership_wall_active boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'membership_price') THEN
        ALTER TABLE public.site_settings ADD COLUMN membership_price decimal(12,2) DEFAULT 1000.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'membership_duration_days') THEN
        ALTER TABLE public.site_settings ADD COLUMN membership_duration_days integer DEFAULT 30;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'membership_title') THEN
        ALTER TABLE public.site_settings ADD COLUMN membership_title text DEFAULT 'ReadMart Premium Member';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'membership_description') THEN
        ALTER TABLE public.site_settings ADD COLUMN membership_description text;
    END IF;
    
    -- Hero Section
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'hero_headline') THEN
        ALTER TABLE public.site_settings ADD COLUMN hero_headline text DEFAULT 'Curated Wisdom for the African Mind';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'hero_subtext') THEN
        ALTER TABLE public.site_settings ADD COLUMN hero_subtext text DEFAULT 'Discover a world of literature, culture, and community.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'hero_image_url') THEN
        ALTER TABLE public.site_settings ADD COLUMN hero_image_url text DEFAULT '/assets/hero.jpg';
    END IF;
    
    -- Social & Contact
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'instagram_url') THEN
        ALTER TABLE public.site_settings ADD COLUMN instagram_url text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'facebook_url') THEN
        ALTER TABLE public.site_settings ADD COLUMN facebook_url text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'twitter_url') THEN
        ALTER TABLE public.site_settings ADD COLUMN twitter_url text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'x_url') THEN
        ALTER TABLE public.site_settings ADD COLUMN x_url text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'linkedin_url') THEN
        ALTER TABLE public.site_settings ADD COLUMN linkedin_url text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'tiktok_url') THEN
        ALTER TABLE public.site_settings ADD COLUMN tiktok_url text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'threads_url') THEN
        ALTER TABLE public.site_settings ADD COLUMN threads_url text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'working_hours') THEN
        ALTER TABLE public.site_settings ADD COLUMN working_hours text DEFAULT 'Mon-Fri: 8am - 5pm';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'secondary_phone') THEN
        ALTER TABLE public.site_settings ADD COLUMN secondary_phone text;
    END IF;
END $$;

-- 3. Ensure foreign key names are explicit for order_items to assist PostgREST
-- This helps when doing .select('*, orders!inner(*)')
ALTER TABLE public.order_items 
DROP CONSTRAINT IF EXISTS order_items_order_id_fkey,
ADD CONSTRAINT order_items_order_id_fkey 
    FOREIGN KEY (order_id) 
    REFERENCES public.orders(id) 
    ON DELETE CASCADE;

-- 4. Storage RLS Policy Corrections
-- Re-create the product upload policy to be more permissive for authenticated users in admin roles
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage products" ON storage.objects;

CREATE POLICY "Admins can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'products' 
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'founder')
    )
);

CREATE POLICY "Admins can manage all product images"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'products' 
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('admin', 'founder')
    )
);

-- 5. Force schema cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;
