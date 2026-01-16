-- ==========================================
-- Migration: Force-Sync Settings Table Schema
-- ==========================================
-- This script handles the case where a 'settings' table exists but lacks the 'id' column.
-- It will safely rename or drop the conflicting table to ensure a clean state.

BEGIN;

-- 1. Check for a conflicting table and resolve it
-- If the table exists but doesn't have an 'id' column, we drop it to start fresh
-- (This is safe as we assume the previous table was likely empty or incorrect)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'id') THEN
            -- Rename the old table instead of dropping, just in case there's data
            ALTER TABLE public.settings RENAME TO settings_old_backup;
        END IF;
    END IF;
END $$;

-- 2. Create the settings table with the correct schema
CREATE TABLE IF NOT EXISTS public.settings (
    id text PRIMARY KEY DEFAULT 'global',
    site_name text DEFAULT 'ReadMart',
    site_logo text DEFAULT '/assets/logo.jpg',
    whatsapp_link text DEFAULT 'https://wa.me/254700000000',
    contact_email text DEFAULT 'hello@readmart.com',
    contact_phone text DEFAULT '+254 700 000 000',
    address text DEFAULT 'Nairobi, Kenya',
    working_hours text DEFAULT 'Mon-Fri: 8am - 5pm',
    tax_rate decimal(5,2) DEFAULT 16.00,
    default_currency text DEFAULT 'KES',
    maintenance_mode boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT null
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 4. Recreate Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.settings;
    DROP POLICY IF EXISTS "Only admins and founders can update settings" ON public.settings;
END $$;

CREATE POLICY "Settings are viewable by everyone" ON public.settings
    FOR SELECT USING (true);

CREATE POLICY "Only admins and founders can update settings" ON public.settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'founder')
        )
    );

-- 5. Seed the default 'global' settings row
INSERT INTO public.settings (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

COMMIT;
