-- Migration: Add key terms to agreements table
-- Description: Adds a jsonb column for highlighting key terms in agreements.

BEGIN;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agreements') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agreements' AND column_name = 'key_terms') THEN
            ALTER TABLE public.agreements 
            ADD COLUMN key_terms jsonb DEFAULT '[]'::jsonb;
        END IF;
    END IF;
END $$;

COMMIT;
