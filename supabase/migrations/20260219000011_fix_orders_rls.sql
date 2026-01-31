-- ==========================================
-- Migration: Fix Orders RLS Policies
-- Target: orders, order_items
-- Description: Ensures users can create and view their own orders.
-- ==========================================

BEGIN;

-- 1. Orders Table RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Drop existing policies to avoid conflicts
    DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
    DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
    DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
    DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
    DROP POLICY IF EXISTS "Founders can manage all orders" ON public.orders;
END $$;

-- Allow authenticated users to create orders
CREATE POLICY "Users can insert their own orders" ON public.orders
    FOR INSERT 
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own orders
CREATE POLICY "Users can view their own orders" ON public.orders
    FOR SELECT 
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow admins/founders to manage everything
CREATE POLICY "Admins can manage all orders" ON public.orders
    FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

-- 2. Order Items Table RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can insert their own order items" ON public.order_items;
    DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
    DROP POLICY IF EXISTS "Admins can manage all order items" ON public.order_items;
    DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
END $$;

-- Allow users to insert items for their own orders
CREATE POLICY "Users can insert their own order items" ON public.order_items
    FOR INSERT 
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE id = order_id 
            AND user_id = auth.uid()
        )
    );

-- Allow users to view items for their own orders
CREATE POLICY "Users can view their own order items" ON public.order_items
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders 
            WHERE id = order_id 
            AND user_id = auth.uid()
        )
    );

-- Allow admins/founders to manage all order items
CREATE POLICY "Admins can manage all order items" ON public.order_items
    FOR ALL 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

COMMIT;
