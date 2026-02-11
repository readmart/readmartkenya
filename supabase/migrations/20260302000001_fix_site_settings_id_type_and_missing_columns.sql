-- ==========================================
-- Migration: Fix Site Settings ID Type and Missing Columns
-- Description: Safely converts site_settings.id from UUID to TEXT and adds missing columns.
-- ==========================================

BEGIN;

-- 1. Safely convert ID from UUID to TEXT
-- We check the type first to avoid errors if already converted
DO $$ 
BEGIN
    IF (SELECT data_type FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'id') = 'uuid' THEN
        
        ALTER TABLE public.site_settings ALTER COLUMN id DROP DEFAULT;
        ALTER TABLE public.site_settings ALTER COLUMN id TYPE text USING id::text;
        ALTER TABLE public.site_settings ALTER COLUMN id SET DEFAULT 'global';
    END IF;
END $$;

-- 2. Add missing columns to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS secondary_phone text DEFAULT '+254 741 658 548',
ADD COLUMN IF NOT EXISTS tax_rate decimal(5,2) DEFAULT 16.00,
ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'KES',
ADD COLUMN IF NOT EXISTS hero_headline text DEFAULT 'EVERY PAGE TELLS A STORY',
ADD COLUMN IF NOT EXISTS hero_subtext text DEFAULT 'Discover a curated sanctuary for bibliophiles.',
ADD COLUMN IF NOT EXISTS hero_image_url text;

-- 3. Add missing columns to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'physical',
ADD COLUMN IF NOT EXISTS sale_price decimal(12,2);

-- 4. Ensure the 'global' row exists
-- Clean up any rows that aren't using the 'global' ID
DELETE FROM public.site_settings WHERE id != 'global';
INSERT INTO public.site_settings (id, site_name)
VALUES ('global', 'READMART')
ON CONFLICT (id) DO UPDATE SET site_name = EXCLUDED.site_name;

-- 5. Refresh Security and Cache
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.site_settings;
CREATE POLICY "Allow public read access" ON public.site_settings FOR SELECT USING (true);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.products;
CREATE POLICY "Allow public read access" ON public.products FOR SELECT USING (is_active = true);

-- 6. Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
