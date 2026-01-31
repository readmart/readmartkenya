-- ==========================================
-- Migration: Fix Total Amount Trigger V2
-- Description: Ensures total_amount is calculated correctly and handles nulls.
-- ==========================================

BEGIN;

-- 1. Ensure columns have correct defaults and types
ALTER TABLE public.orders ALTER COLUMN subtotal_amount SET DEFAULT 0.00;
ALTER TABLE public.orders ALTER COLUMN shipping_amount SET DEFAULT 0.00;
ALTER TABLE public.orders ALTER COLUMN tax_amount SET DEFAULT 0.00;
ALTER TABLE public.orders ALTER COLUMN total_amount SET DEFAULT 0.00;

-- 2. Update existing nulls if any
UPDATE public.orders SET subtotal_amount = 0.00 WHERE subtotal_amount IS NULL;
UPDATE public.orders SET shipping_amount = 0.00 WHERE shipping_amount IS NULL;
UPDATE public.orders SET tax_amount = 0.00 WHERE tax_amount IS NULL;
UPDATE public.orders SET total_amount = 0.00 WHERE total_amount IS NULL;

-- 3. Robust Trigger Function
CREATE OR REPLACE FUNCTION public.handle_order_financials()
RETURNS TRIGGER AS $$
DECLARE
    v_tax_rate decimal;
BEGIN
    -- Get current tax rate from site_settings
    SELECT tax_rate INTO v_tax_rate FROM public.site_settings LIMIT 1;
    
    -- Default to 16% if settings not found
    IF v_tax_rate IS NULL THEN
        v_tax_rate := 16.00;
    END IF;

    -- Calculate tax_amount (ensure inputs are not null)
    NEW.tax_amount := COALESCE(NEW.subtotal_amount, 0) * (v_tax_rate / 100);
    
    -- Calculate total_amount (ensure inputs are not null)
    NEW.total_amount := COALESCE(NEW.subtotal_amount, 0) + COALESCE(NEW.tax_amount, 0) + COALESCE(NEW.shipping_amount, 0);
    
    -- If total_amount is still null (shouldn't happen with COALESCE), set to 0 to satisfy NOT NULL
    IF NEW.total_amount IS NULL THEN
        NEW.total_amount := 0.00;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-attach the trigger
DROP TRIGGER IF EXISTS tr_calculate_order_financials ON public.orders;
CREATE TRIGGER tr_calculate_order_financials
    BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_order_financials();

-- 5. Force refresh cache
NOTIFY pgrst, 'reload schema';

COMMIT;
