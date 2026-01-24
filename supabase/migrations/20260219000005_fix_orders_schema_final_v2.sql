-- ==========================================
-- Migration: Fix Orders Schema Final V2
-- Target: orders
-- Description: Aggressively ensures shipping_zone_id exists and forces schema reload multiple times.
-- ==========================================

BEGIN;

-- 1. Ensure shipping_zone_id exists in public.orders
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_zone_id') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_zone_id uuid REFERENCES public.shipping_zones(id);
    END IF;
END $$;

-- 2. Ensure other critical columns exist (just in case)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_method') THEN
        ALTER TABLE public.orders ADD COLUMN payment_method text DEFAULT 'm-pesa';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'subtotal_amount') THEN
        ALTER TABLE public.orders ADD COLUMN subtotal_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.orders ADD COLUMN tax_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_amount') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_amount') THEN
        ALTER TABLE public.orders ADD COLUMN total_amount decimal(12,2) DEFAULT 0.00;
    END IF;
END $$;

-- 3. Force multiple schema reloads to ensure PostgREST picks it up
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(0.1);
NOTIFY pgrst, 'reload schema';

COMMIT;
