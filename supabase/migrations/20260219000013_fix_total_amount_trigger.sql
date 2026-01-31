-- ==========================================
-- FIX: ORDERS TOTAL_AMOUNT & TRIGGER ROBUSTNESS
-- ==========================================

BEGIN;

-- 1. Ensure columns exist and have correct defaults to prevent NULL constraint errors
ALTER TABLE public.orders ALTER COLUMN subtotal_amount SET DEFAULT 0.00;
ALTER TABLE public.orders ALTER COLUMN shipping_amount SET DEFAULT 0.00;
ALTER TABLE public.orders ALTER COLUMN tax_amount SET DEFAULT 0.00;
ALTER TABLE public.orders ALTER COLUMN total_amount SET DEFAULT 0.00;

-- 2. Force update any existing NULLs to 0.00 (to allow making them NOT NULL if needed)
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
    -- Get tax rate from settings or default to 16%
    SELECT tax_rate INTO v_tax_rate FROM public.site_settings LIMIT 1;
    IF v_tax_rate IS NULL THEN v_tax_rate := 16.00; END IF;

    -- Calculate with COALESCE for safety
    NEW.tax_amount := COALESCE(NEW.subtotal_amount, 0) * (v_tax_rate / 100);
    NEW.total_amount := COALESCE(NEW.subtotal_amount, 0) + NEW.tax_amount + COALESCE(NEW.shipping_amount, 0);
    
    -- Ensure we never return NULL for total_amount
    IF NEW.total_amount IS NULL THEN
        NEW.total_amount := 0.00;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-create trigger to ensure it fires on ALL inserts and updates
DROP TRIGGER IF EXISTS tr_calculate_order_financials ON public.orders;
CREATE TRIGGER tr_calculate_order_financials
    BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE PROCEDURE public.handle_order_financials();

-- 5. Reload Schema Cache
NOTIFY pgrst, 'reload schema';

COMMIT;
