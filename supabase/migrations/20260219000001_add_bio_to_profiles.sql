
-- ==========================================
-- Migration: Add bio to Profiles
-- Target: profiles
-- Description: Adds missing bio column to profiles table to support Author of the Day features.
-- ==========================================

BEGIN;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio') THEN
        ALTER TABLE public.profiles ADD COLUMN bio text;
    END IF;
END $$;

COMMIT;
