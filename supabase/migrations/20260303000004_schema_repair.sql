-- Migration: Schema Repair and Cache Invalidation
-- Description: Ensures critical columns exist and forces a schema cache refresh

BEGIN;

-- 1. Ensure products table has expected columns
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_ebook boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS type text DEFAULT 'physical',
ADD COLUMN IF NOT EXISTS author text,
ADD COLUMN IF NOT EXISTS ebook_url text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Ensure order_items has product_snapshot
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS product_snapshot jsonb DEFAULT '{}'::jsonb;

-- 3. Notify PostgREST to reload schema (by performing a dummy DDL)
COMMENT ON TABLE public.order_items IS 'Stores items for each order, including a snapshot of the product at purchase time.';
COMMENT ON TABLE public.products IS 'Main products table supporting physical and digital (ebook) goods.';

COMMIT;
