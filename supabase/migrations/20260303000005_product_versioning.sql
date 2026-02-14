-- Migration: Product Versioning and Change Tracking
-- Description: Adds a table to store snapshots of products for version control and rollback.

BEGIN;

-- 1. Create product_versions table
CREATE TABLE IF NOT EXISTS public.product_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    changed_by UUID REFERENCES public.profiles(id),
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_versions_product_id ON public.product_versions(product_id);

-- 3. Enable RLS
ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Admins/Founders can view all versions
CREATE POLICY "Admins can view all product versions" ON public.product_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

-- Authors can view versions of their own products
CREATE POLICY "Authors can view their product versions" ON public.product_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.products 
            WHERE id = product_versions.product_id 
            AND author_id = auth.uid()
        )
    );

-- 5. Add version tracking to products table if not exists
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;

COMMIT;
