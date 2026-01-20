-- ==========================================
-- Migration: Comprehensive Order Schema Fix
-- Target: orders, order_items
-- Adds missing columns, fixes schema cache issues, and implements backend VAT calculation
-- ==========================================

BEGIN;

-- 1. Fix public.orders table
DO $$ 
BEGIN
    -- Add subtotal_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'subtotal_amount') THEN
        ALTER TABLE public.orders ADD COLUMN subtotal_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Add tax_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.orders ADD COLUMN tax_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Add shipping_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_amount') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Add total_amount (ensure it exists and is decimal)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_amount') THEN
        ALTER TABLE public.orders ADD COLUMN total_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Add shipping_zone_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_zone_id') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_zone_id uuid REFERENCES public.shipping_zones(id);
    END IF;

    -- Ensure payment_id and payment_metadata are nullable
    ALTER TABLE public.orders ALTER COLUMN payment_id DROP NOT NULL;
    ALTER TABLE public.orders ALTER COLUMN payment_metadata DROP NOT NULL;
END $$;

-- 2. Fix public.order_items table
DO $$ 
BEGIN
    -- Fix price_at_purchase (The common cache error column)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'price_at_purchase') THEN
        ALTER TABLE public.order_items ADD COLUMN price_at_purchase decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Ensure other critical columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_snapshot') THEN
        ALTER TABLE public.order_items ADD COLUMN product_snapshot jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. Backend VAT Calculation Trigger
-- This function will calculate tax and total whenever an order is created or updated
CREATE OR REPLACE FUNCTION public.handle_order_financials()
RETURNS TRIGGER AS $$
DECLARE
    v_tax_rate decimal;
BEGIN
    -- 1. Get current tax rate from settings
    SELECT tax_rate INTO v_tax_rate FROM public.settings WHERE id = 'global' LIMIT 1;
    
    -- Default to 16% if settings not found
    IF v_tax_rate IS NULL THEN
        v_tax_rate := 16.00;
    END IF;

    -- 2. Calculate tax_amount
    NEW.tax_amount := NEW.subtotal_amount * (v_tax_rate / 100);
    
    -- 3. Calculate total_amount
    NEW.total_amount := NEW.subtotal_amount + NEW.tax_amount + NEW.shipping_amount;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_calculate_order_financials ON public.orders;
CREATE TRIGGER tr_calculate_order_financials
    BEFORE INSERT OR UPDATE OF subtotal_amount, shipping_amount ON public.orders
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_order_financials();

COMMIT;