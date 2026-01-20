-- ==========================================
-- Migration: Comprehensive Site Settings & Product Fixes
-- ==========================================

BEGIN;

-- 1. Unify Settings Table to site_settings
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_settings') THEN
            ALTER TABLE public.settings RENAME TO site_settings;
        ELSE
            -- If both exist, we might need to merge or just drop settings if site_settings is already good
            DROP TABLE public.settings;
        END IF;
    END IF;
END $$;

-- 2. Ensure site_settings has all required columns
CREATE TABLE IF NOT EXISTS public.site_settings (
    id text PRIMARY KEY DEFAULT 'global',
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Identity & Connectivity
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS site_name text DEFAULT 'ReadMart',
ADD COLUMN IF NOT EXISTS site_logo text DEFAULT '/assets/logo.jpg',
ADD COLUMN IF NOT EXISTS whatsapp_link text DEFAULT 'https://wa.me/254700000000',
ADD COLUMN IF NOT EXISTS contact_email text DEFAULT 'hello@readmart.com',
ADD COLUMN IF NOT EXISTS contact_phone text DEFAULT '+254 700 000 000',
ADD COLUMN IF NOT EXISTS address text DEFAULT 'Nairobi, Kenya',
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS x_url text,
ADD COLUMN IF NOT EXISTS linkedin_url text;

-- Global Logic
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS tax_rate decimal(5,2) DEFAULT 16.00,
ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'KES',
ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS global_announcement text,
ADD COLUMN IF NOT EXISTS announcement_active boolean DEFAULT false;

-- Membership Infrastructure
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS membership_wall_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS membership_price decimal(12,2) DEFAULT 1000.00,
ADD COLUMN IF NOT EXISTS membership_duration_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS membership_title text DEFAULT 'ReadMart Premium Member',
ADD COLUMN IF NOT EXISTS membership_description text DEFAULT 'Get exclusive access to book clubs, insights, and early bird events.';

-- 3. Product & E-book Enhancements
-- Ensure products table has is_active and ebook fields
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_ebook boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ebook_url text;

-- 3.1 Contact Messages Enhancements
ALTER TABLE public.contact_messages
ADD COLUMN IF NOT EXISTS department text;

-- Add author_id if missing (already added in 20260117000000_rbac_roles.sql but double checking)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'author_id') THEN
        ALTER TABLE public.products ADD COLUMN author_id uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- 4. Hero Section Configuration
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS hero_headline text DEFAULT 'EVERY PAGE TELLS A STORY',
ADD COLUMN IF NOT EXISTS hero_subtext text DEFAULT 'Discover a curated sanctuary for bibliophiles and art enthusiasts. Bridging the gap between creators and readers.',
ADD COLUMN IF NOT EXISTS hero_image_url text DEFAULT 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=1200';

-- 5. Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 6. Policies
DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
CREATE POLICY "Public can view site settings" ON public.site_settings
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings" ON public.site_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

-- 7. Initialize Global Settings row
INSERT INTO public.site_settings (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

COMMIT;
