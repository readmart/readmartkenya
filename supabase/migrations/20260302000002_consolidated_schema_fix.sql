-- ==========================================
-- CONSOLIDATED SCHEMA FIX (March 2026)
-- Resolves: 
-- 1. site_settings.id type (UUID -> TEXT)
-- 2. Missing columns in site_settings (tiktok, threads, etc.)
-- 3. Missing columns in products (type, sale_price, etc.)
-- 4. PostgREST schema cache issues
-- ==========================================

BEGIN;

-- 1. Fix site_settings id type
DO $$ 
BEGIN
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'id') = 'uuid' THEN
        
        -- Drop default before changing type
        ALTER TABLE public.site_settings ALTER COLUMN id DROP DEFAULT;
        
        -- Convert column to text
        ALTER TABLE public.site_settings ALTER COLUMN id TYPE text USING id::text;
        
        -- Set new default
        ALTER TABLE public.site_settings ALTER COLUMN id SET DEFAULT 'global';
        
        RAISE NOTICE 'Converted site_settings.id from UUID to TEXT';
    END IF;
END $$;

-- 2. Add ALL missing columns to site_settings used by the frontend
-- We add them all at once to ensure the schema matches the useSettings hook
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS contact_phone text DEFAULT '+254 794 129 958',
ADD COLUMN IF NOT EXISTS secondary_phone text DEFAULT '+254 741 658 548',
ADD COLUMN IF NOT EXISTS address text DEFAULT 'Nairobi, Kenya',
ADD COLUMN IF NOT EXISTS working_hours text DEFAULT 'Mon-Fri: 8am - 5pm',
ADD COLUMN IF NOT EXISTS tax_rate decimal DEFAULT 16.00,
ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'KES',
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS x_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text,
ADD COLUMN IF NOT EXISTS threads_url text,
ADD COLUMN IF NOT EXISTS global_announcement text,
ADD COLUMN IF NOT EXISTS announcement_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS membership_wall_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS membership_price decimal DEFAULT 1000.00,
ADD COLUMN IF NOT EXISTS membership_duration_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS membership_title text DEFAULT 'ReadMart Premium Member',
ADD COLUMN IF NOT EXISTS membership_description text,
ADD COLUMN IF NOT EXISTS author_of_the_day_id uuid,
ADD COLUMN IF NOT EXISTS author_of_the_day_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS author_of_the_day_books uuid[],
ADD COLUMN IF NOT EXISTS author_of_the_day_image text,
ADD COLUMN IF NOT EXISTS hero_headline text DEFAULT 'EVERY PAGE TELLS A STORY',
ADD COLUMN IF NOT EXISTS hero_subtext text DEFAULT 'Discover a curated sanctuary for bibliophiles.',
ADD COLUMN IF NOT EXISTS hero_image_url text;

-- 3. Ensure products table has correct columns for the shop and analytics
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS author text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS type text DEFAULT 'physical',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS sale_price decimal,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0;

-- 4. Ensure the 'global' record exists and is unique
-- First, make sure we don't have multiple records if we just converted from UUID
DO $$
BEGIN
    IF (SELECT count(*) FROM public.site_settings) > 1 THEN
        DELETE FROM public.site_settings WHERE id != 'global' AND id != (SELECT id FROM public.site_settings LIMIT 1);
    END IF;
END $$;

INSERT INTO public.site_settings (id, site_name)
VALUES ('global', 'ReadMart')
ON CONFLICT (id) DO UPDATE SET 
    site_name = EXCLUDED.site_name
    WHERE public.site_settings.site_name IS NULL;

-- 5. Force PostgREST to reload the schema cache
-- This is critical to resolve PGRST205 errors immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
