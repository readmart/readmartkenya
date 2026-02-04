-- Migration: Final RLS Unification and Admin Gaps Fix
-- Description: Unifies RLS policies, ensures admins/founders have proper access, and adds missing user policies.

BEGIN;

-- 1. Profiles: Allow Admins/Founders to update all profiles (needed for role updates and deactivation)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
        DROP POLICY IF EXISTS "Admins/Founders can update all profiles" ON public.profiles;
        CREATE POLICY "Admins/Founders can update all profiles" ON public.profiles
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- 2. Audit Logs: Include Admins in viewing
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        DROP POLICY IF EXISTS "Founders can view all audit logs" ON public.audit_logs;
        DROP POLICY IF EXISTS "Admins/Founders can view all audit logs" ON public.audit_logs;
        CREATE POLICY "Admins/Founders can view all audit logs" ON public.audit_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- 3. Agreements: Include Admins in management
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agreements') THEN
        DROP POLICY IF EXISTS "Founders can manage all agreements" ON public.agreements;
        DROP POLICY IF EXISTS "Admins/Founders can manage all agreements" ON public.agreements;
        CREATE POLICY "Admins/Founders can manage all agreements" ON public.agreements
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- 4. Clubs: Include Admins in management
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clubs') THEN
        DROP POLICY IF EXISTS "Founders can manage clubs" ON public.clubs;
        DROP POLICY IF EXISTS "Admins/Founders can manage clubs" ON public.clubs;
        CREATE POLICY "Admins/Founders can manage clubs" ON public.clubs
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- 5. Events: Include Admins in management
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
        DROP POLICY IF EXISTS "Founders can manage events" ON public.events;
        DROP POLICY IF EXISTS "Admins/Founders can manage events" ON public.events;
        CREATE POLICY "Admins/Founders can manage events" ON public.events
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- 6. Orders: Include Admins in management (SELECT and UPDATE)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        DROP POLICY IF EXISTS "Founders and admins can view all orders" ON public.orders;
        DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
        DROP POLICY IF EXISTS "Admins/Founders can manage all orders" ON public.orders;
        CREATE POLICY "Admins/Founders can manage all orders" ON public.orders
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- 7. Order Items: Add INSERT policy for users and ALL for admins
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        DROP POLICY IF EXISTS "Founders and admins can view all order items" ON public.order_items;
        DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
        DROP POLICY IF EXISTS "Admins/Founders can manage all order items" ON public.order_items;
        CREATE POLICY "Admins/Founders can manage all order items" ON public.order_items
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );

        DROP POLICY IF EXISTS "Users can insert their own order items" ON public.order_items;
        CREATE POLICY "Users can insert their own order items" ON public.order_items
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.orders 
                    WHERE id = order_id 
                    AND user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 8. Shipping Zones: Consistency check
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipping_zones') THEN
        DROP POLICY IF EXISTS "Admins can manage shipping zones" ON public.shipping_zones;
        DROP POLICY IF EXISTS "Admins/Founders can manage shipping zones" ON public.shipping_zones;
        CREATE POLICY "Admins/Founders can manage shipping zones" ON public.shipping_zones
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- 9. Fulfillment Ledger: Include Admins in management
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger') THEN
        DROP POLICY IF EXISTS "Admins can view all fulfillment records" ON public.fulfillment_ledger;
        DROP POLICY IF EXISTS "Admins/Founders can manage all fulfillment records" ON public.fulfillment_ledger;
        CREATE POLICY "Admins/Founders can manage all fulfillment records" ON public.fulfillment_ledger
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- 10. Update existing policies to check for is_active = true for non-admin roles
-- Products
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        -- Check if author_id column exists before creating/dropping the policy that uses it
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'author_id') THEN
            DROP POLICY IF EXISTS "Authors can manage their own products" ON public.products;
            CREATE POLICY "Authors can manage their own products" ON public.products
                FOR ALL USING (
                    auth.uid() = author_id 
                    AND EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role = 'author' 
                        AND is_active = true
                    )
                );
        END IF;
    END IF;
END $$;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
