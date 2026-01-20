-- ==========================================
-- Migration: Ensure Product Columns Exist
-- Target: products
-- ==========================================

BEGIN;

-- 1. Ensure products table has all columns expected by the frontend
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_ebook boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ebook_url text,
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS author text,
ADD COLUMN IF NOT EXISTS type text DEFAULT 'physical',
ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0;

-- 2. Make slug optional or ensure it has a default if we want to support inserts without it
-- However, slug is usually required for URLs. For now, let's just make it nullable 
-- to prevent insert failures, but ideally the frontend or a trigger should provide it.
ALTER TABLE public.products ALTER COLUMN slug DROP NOT NULL;

-- 3. Update RLS policies to use is_active safely
-- First, drop if they exist to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
    DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
END $$;

-- Public can see active products
CREATE POLICY "Products are viewable by everyone" ON public.products 
    FOR SELECT USING (is_active = true);

-- Admins/Founders can do everything
CREATE POLICY "Admins can manage products" ON public.products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

COMMIT;
