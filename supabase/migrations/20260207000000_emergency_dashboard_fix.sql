-- ==========================================
-- EMERGENCY DASHBOARD FIX: Comprehensive Schema Synchronization
-- ==========================================
-- This script fixes all missing tables, columns, and enums identified 
-- in the browser console errors to ensure the Founder Dashboard fully works.

BEGIN;

-- 1. FIX: Role Enum (Add 'author' and 'partner' if they don't exist)
DO $$ 
BEGIN
    -- If user_role is an ENUM, we need to add values
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'author';
        ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'partner';
    END IF;

    -- If role is a check constraint on profiles, update it
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
            CHECK (role IN ('customer', 'admin', 'founder', 'author', 'partner'));
    END IF;
END $$;

-- 2. FIX: Profiles Table (Missing columns)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 3. FIX: Shipping Zones Table (Missing logistics columns)
ALTER TABLE public.shipping_zones 
ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'KE',
ADD COLUMN IF NOT EXISTS region text,
ADD COLUMN IF NOT EXISTS postal_codes text,
ADD COLUMN IF NOT EXISTS shipping_method text DEFAULT 'Standard',
ADD COLUMN IF NOT EXISTS county text,
ADD COLUMN IF NOT EXISTS weight_surcharge decimal(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS volume_surcharge decimal(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS estimated_days integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS valid_from timestamp with time zone DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS valid_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 4. FIX: Site Settings Table (Ensure it exists and has spotlight columns)
CREATE TABLE IF NOT EXISTS public.site_settings (
    id text PRIMARY KEY DEFAULT 'global',
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS site_name text DEFAULT 'ReadMart',
ADD COLUMN IF NOT EXISTS site_logo text DEFAULT '/assets/logo.jpg',
ADD COLUMN IF NOT EXISTS whatsapp_link text DEFAULT 'https://wa.me/254794129958',
ADD COLUMN IF NOT EXISTS contact_email text DEFAULT 'hello@readmart.com',
ADD COLUMN IF NOT EXISTS contact_phone text DEFAULT '+254 794 129 958',
ADD COLUMN IF NOT EXISTS address text DEFAULT 'Nairobi, Kenya',
ADD COLUMN IF NOT EXISTS author_of_the_day_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS author_of_the_day_image text,
ADD COLUMN IF NOT EXISTS author_of_the_day_books uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS author_of_the_day_enabled boolean DEFAULT false;

-- Initialize if empty
INSERT INTO public.site_settings (id)
SELECT 'global'
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE id = 'global');

-- 5. FIX: Newsletter Subscriptions (Missing table)
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. FIX: Audit Logs (Missing table)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() primary key,
    user_id uuid REFERENCES public.profiles(id),
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. FIX: Products Table (Missing author association)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_ebook boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ebook_url text;

-- 8. SECURITY: Enable RLS and Basic Policies
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Select policies for admins
DO $$ 
BEGIN
    -- Newsletter
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view newsletter subscriptions') THEN
        CREATE POLICY "Admins can view newsletter subscriptions" ON public.newsletter_subscriptions
        FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'founder')));
    END IF;

    -- Audit Logs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Founders can view all audit logs') THEN
        CREATE POLICY "Founders can view all audit logs" ON public.audit_logs
        FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'founder'));
    END IF;

    -- Site Settings
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public can view site settings') THEN
        CREATE POLICY "Public can view site settings" ON public.site_settings FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage site settings') THEN
        CREATE POLICY "Admins can manage site settings" ON public.site_settings
        FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

COMMIT;
