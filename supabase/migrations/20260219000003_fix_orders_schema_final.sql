-- ==========================================
-- Migration: Fix Orders Schema Final
-- Target: orders
-- Description: Ensures all required columns exist for checkout and payments.
-- ==========================================

BEGIN;

-- 1. Ensure critical columns exist in public.orders
DO $$ 
BEGIN
    -- Add shipping_zone_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_zone_id') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_zone_id uuid REFERENCES public.shipping_zones(id);
    END IF;

    -- Add payment_method if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE public.orders ADD COLUMN payment_method text DEFAULT 'm-pesa';
    END IF;

    -- Ensure financial columns are decimal
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'subtotal_amount') THEN
        ALTER TABLE public.orders ADD COLUMN subtotal_amount decimal(12,2) DEFAULT 0.00;
    ELSE
        ALTER TABLE public.orders ALTER COLUMN subtotal_amount TYPE decimal(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.orders ADD COLUMN tax_amount decimal(12,2) DEFAULT 0.00;
    ELSE
        ALTER TABLE public.orders ALTER COLUMN tax_amount TYPE decimal(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_amount') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_amount decimal(12,2) DEFAULT 0.00;
    ELSE
        ALTER TABLE public.orders ALTER COLUMN shipping_amount TYPE decimal(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_amount') THEN
        ALTER TABLE public.orders ADD COLUMN total_amount decimal(12,2) DEFAULT 0.00;
    ELSE
        ALTER TABLE public.orders ALTER COLUMN total_amount TYPE decimal(12,2);
    END IF;

    -- Ensure payment_id and payment_metadata are nullable
    ALTER TABLE public.orders ALTER COLUMN payment_id DROP NOT NULL;
    ALTER TABLE public.orders ALTER COLUMN payment_metadata DROP NOT NULL;
END $$;

-- 2. Re-create or Update handle_order_financials trigger
-- This ensures tax and total are always calculated correctly on the backend
CREATE OR REPLACE FUNCTION public.handle_order_financials()
RETURNS TRIGGER AS $$
DECLARE
    v_tax_rate decimal;
BEGIN
    -- 1. Get current tax rate from site_settings (unified table)
    -- We try both 'global' and any single record as fallback
    SELECT tax_rate INTO v_tax_rate FROM public.site_settings WHERE id = 'global' LIMIT 1;
    
    -- Fallback to first record if 'global' id doesn't exist
    IF v_tax_rate IS NULL THEN
        SELECT tax_rate INTO v_tax_rate FROM public.site_settings LIMIT 1;
    END IF;

    -- Default to 16% if settings not found at all
    IF v_tax_rate IS NULL THEN
        v_tax_rate := 16.00;
    END IF;

    -- 2. Calculate tax_amount
    NEW.tax_amount := COALESCE(NEW.subtotal_amount, 0) * (v_tax_rate / 100);
    
    -- 3. Calculate total_amount
    NEW.total_amount := COALESCE(NEW.subtotal_amount, 0) + NEW.tax_amount + COALESCE(NEW.shipping_amount, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach the trigger
DROP TRIGGER IF EXISTS tr_calculate_order_financials ON public.orders;
CREATE TRIGGER tr_calculate_order_financials
    BEFORE INSERT OR UPDATE OF subtotal_amount, shipping_amount ON public.orders
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_order_financials();

-- 3. Synchronize Schema Cache (PostgREST)
-- We use this comment to signal Supabase/PostgREST to reload the schema cache if possible
-- Or we just ensure the columns are there so the next request succeeds.
NOTIFY pgrst, 'reload schema';

COMMIT;
