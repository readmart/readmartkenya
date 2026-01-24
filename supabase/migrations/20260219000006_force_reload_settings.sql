-- ==========================================
-- Migration: Force Schema Reload for Site Settings
-- Target: site_settings, profiles
-- Description: Ensures all columns for Author of the Day exist and forces schema reload.
-- ==========================================

BEGIN;

-- 1. Ensure bio exists in profiles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio') THEN
        ALTER TABLE public.profiles ADD COLUMN bio text;
    END IF;
END $$;

-- 2. Ensure Author of the Day columns exist in site_settings
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_id') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_id uuid REFERENCES public.profiles(id);
    ELSE
        -- Ensure it's a foreign key if it exists but might not be linked
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints tc 
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
            WHERE tc.table_name = 'site_settings' AND kcu.column_name = 'author_of_the_day_id' AND tc.constraint_type = 'FOREIGN KEY'
        ) THEN
            ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_author_of_the_day_id_fkey 
            FOREIGN KEY (author_of_the_day_id) REFERENCES public.profiles(id);
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_enabled') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_enabled boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_books') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_books uuid[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_image') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_image text;
    END IF;
END $$;

-- 3. Force multiple schema reloads
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(0.1);
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(0.1);
NOTIFY pgrst, 'reload schema';

COMMIT;
