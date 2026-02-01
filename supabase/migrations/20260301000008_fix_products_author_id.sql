
-- Migration: Fix missing author_id in products and reload schema
-- Description: Ensures author_id column exists in products table and forces PostgREST schema reload

BEGIN;

-- 1. Ensure author_id column exists in products
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'author_id') THEN
        ALTER TABLE public.products ADD COLUMN author_id uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- 2. Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
