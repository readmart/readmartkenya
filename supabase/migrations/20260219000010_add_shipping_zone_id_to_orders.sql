-- ==========================================
-- Migration: Fix Orders Schema Missing Column
-- Target: orders
-- Description: Adds shipping_zone_id to orders table.
-- ==========================================

BEGIN;

-- 1. Add shipping_zone_id if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_zone_id') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_zone_id uuid REFERENCES public.shipping_zones(id);
    END IF;
END $$;

COMMIT;
