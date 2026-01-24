-- ==========================================
-- Migration: Fix Shipping Zones Schema & Populate Kenya Towns
-- Target: shipping_zones
-- Description: Unifies price/rate columns and adds major towns
-- ==========================================

BEGIN;

-- 1. Unify Schema (Handle price, rate, base_rate)
DO $$ 
BEGIN
    -- If 'rate' exists but 'price' doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='rate') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='price') THEN
        ALTER TABLE public.shipping_zones RENAME COLUMN rate TO price;
    END IF;

    -- If 'base_rate' exists but 'price' doesn't, rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='base_rate') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='price') THEN
        ALTER TABLE public.shipping_zones RENAME COLUMN base_rate TO price;
    END IF;

    -- Ensure 'price' exists (fallback)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='price') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN price decimal(12,2) NOT NULL DEFAULT 0.00;
    END IF;

    -- Ensure 'estimated_days' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='estimated_days') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN estimated_days integer DEFAULT 3;
    END IF;

    -- Ensure 'is_active' exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shipping_zones' AND column_name='is_active') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN is_active boolean DEFAULT true;
    END IF;
END $$;

-- 2. Clear existing sample data to avoid duplicates
TRUNCATE TABLE public.shipping_zones RESTART IDENTITY CASCADE;

-- 3. Insert Major Kenyan Towns
INSERT INTO public.shipping_zones (name, price, estimated_days, is_active) VALUES
('Nairobi - CBD', 150.00, 1, true),
('Nairobi - Westlands', 200.00, 1, true),
('Nairobi - Kilimani', 200.00, 1, true),
('Nairobi - Karen', 300.00, 1, true),
('Mombasa - Island', 400.00, 2, true),
('Mombasa - Nyali', 450.00, 2, true),
('Kisumu - City', 400.00, 2, true),
('Nakuru - City', 350.00, 2, true),
('Eldoret - City', 400.00, 2, true),
('Thika - Town', 250.00, 1, true),
('Ruiru - Town', 250.00, 1, true),
('Kikuyu - Town', 250.00, 1, true),
('Machakos - Town', 350.00, 2, true),
('Naivasha - Town', 300.00, 1, true),
('Nanyuki - Town', 400.00, 2, true),
('Malindi - Town', 500.00, 3, true),
('Diani - Town', 500.00, 3, true);

COMMIT;
