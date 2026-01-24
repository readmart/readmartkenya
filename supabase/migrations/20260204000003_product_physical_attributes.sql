-- ==========================================
-- Migration: Product Physical Attributes
-- Target: products
-- Description: Adds weight and volume for shipping calculation.
-- ==========================================

BEGIN;

DO $$ 
BEGIN
    -- Product weight in KG
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'weight') THEN
        ALTER TABLE public.products ADD COLUMN weight decimal(12,3) DEFAULT 0.500; -- Default 500g for books
    END IF;

    -- Product volume in cubic meters (m³)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'volume') THEN
        ALTER TABLE public.products ADD COLUMN volume decimal(12,6) DEFAULT 0.001; -- Default 0.001m³
    END IF;
END $$;

-- Validation constraints
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS weight_positive;
ALTER TABLE public.products ADD CONSTRAINT weight_positive CHECK (weight >= 0);

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS volume_positive;
ALTER TABLE public.products ADD CONSTRAINT volume_positive CHECK (volume >= 0);

COMMIT;
