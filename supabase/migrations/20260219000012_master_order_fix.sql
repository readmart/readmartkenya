-- ==========================================
-- MASTER FIX: COMPLETE ORDERS & PAYMENTS SCHEMA
-- Run this in Supabase SQL Editor to fix all errors at once.
-- ==========================================

BEGIN;

-- 1. Fix Orders Table Columns
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_zone_id uuid REFERENCES public.shipping_zones(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal_amount decimal(12,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tax_amount decimal(12,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_amount decimal(12,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_amount decimal(12,2) DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.orders ALTER COLUMN payment_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN payment_metadata DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN payment_metadata SET DEFAULT '{}'::jsonb;

-- 2. Fix Order Items Table Columns
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price decimal(12,2) DEFAULT 0.00;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price_at_purchase decimal(12,2) DEFAULT 0.00;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_snapshot jsonb DEFAULT '{}'::jsonb;

-- 3. Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 4. Orders RLS Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
    DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
    DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
END $$;

CREATE POLICY "Users can insert their own orders" ON public.orders
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all orders" ON public.orders
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
    );

-- 5. Order Items RLS Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can insert their own order items" ON public.order_items;
    DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
    DROP POLICY IF EXISTS "Admins can manage all order items" ON public.order_items;
END $$;

CREATE POLICY "Users can insert their own order items" ON public.order_items
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can view their own order items" ON public.order_items
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid())
    );

CREATE POLICY "Admins can manage all order items" ON public.order_items
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
    );

-- 6. Financial Trigger (The "Math Engine")
CREATE OR REPLACE FUNCTION public.handle_order_financials()
RETURNS TRIGGER AS $$
DECLARE
    v_tax_rate decimal;
BEGIN
    SELECT tax_rate INTO v_tax_rate FROM public.site_settings LIMIT 1;
    IF v_tax_rate IS NULL THEN v_tax_rate := 16.00; END IF;

    NEW.tax_amount := COALESCE(NEW.subtotal_amount, 0) * (v_tax_rate / 100);
    NEW.total_amount := COALESCE(NEW.subtotal_amount, 0) + NEW.tax_amount + COALESCE(NEW.shipping_amount, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_calculate_order_financials ON public.orders;
CREATE TRIGGER tr_calculate_order_financials
    BEFORE INSERT OR UPDATE OF subtotal_amount, shipping_amount ON public.orders
    FOR EACH ROW EXECUTE PROCEDURE public.handle_order_financials();

-- 7. Force Refresh Cache
NOTIFY pgrst, 'reload schema';

COMMIT;
