
-- Migration: Add bio to Profiles
-- Description: Ensures the bio column exists for Author of the Day functionality.

BEGIN;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio') THEN
        ALTER TABLE public.profiles ADD COLUMN bio text;
    END IF;
END $$;

-- Also ensure author_of_the_day_id foreign key is properly set up in site_settings
-- just in case previous migrations failed or were partial
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_id') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_id uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
