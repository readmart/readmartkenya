-- ==========================================
-- Migration: Fix Schema and Create Reviews
-- ==========================================

BEGIN;

-- 1. Create Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS on Reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 3. Reviews Policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
    DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
    DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
    DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;
END $$;

CREATE POLICY "Reviews are viewable by everyone" ON public.reviews 
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert reviews" ON public.reviews 
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own reviews" ON public.reviews 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" ON public.reviews 
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Fix Orders Table Columns (Handling previous broken migration)
DO $$ 
BEGIN
    -- Fix payment_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_id') THEN
        ALTER TABLE public.orders ADD COLUMN payment_id text;
    END IF;

    -- Fix payment_metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_metadata') THEN
        ALTER TABLE public.orders ADD COLUMN payment_metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 5. Add Founder/Admin Policies for Orders and Order Items
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Founders and admins can view all orders" ON public.orders;
    DROP POLICY IF EXISTS "Founders and admins can view all order items" ON public.order_items;
END $$;

CREATE POLICY "Founders and admins can view all orders" ON public.orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

CREATE POLICY "Founders and admins can view all order items" ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

COMMIT;
