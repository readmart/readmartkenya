-- ==========================================
-- Migration: Finalize Site Settings & Legacy Cleanup
-- Target: site_settings, settings
-- Description: Ensures site_settings has all required fields (including working_hours) and removes legacy settings table.
-- ==========================================

BEGIN;

-- 1. Ensure site_settings has all required columns
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS working_hours text DEFAULT 'Mon-Fri: 8am - 5pm';

-- 2. Clean up legacy settings table if it still exists
-- We do a final check and drop it since site_settings is now the source of truth.
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.settings_old_backup CASCADE;

-- 3. Ensure RLS is enabled and policies are correct
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
    DROP POLICY IF EXISTS "Site settings are viewable by everyone" ON public.site_settings;
    DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
END $$;

CREATE POLICY "Public can view site settings" ON public.site_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage site settings" ON public.site_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

-- 4. Ensure the global row exists and is populated
INSERT INTO public.site_settings (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

-- 5. Sync working_hours if it was null
UPDATE public.site_settings 
SET working_hours = 'Mon-Fri: 8am - 5pm' 
WHERE id = 'global' AND working_hours IS NULL;

COMMIT;
