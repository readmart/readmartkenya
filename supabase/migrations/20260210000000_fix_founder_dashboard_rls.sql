-- ==========================================
-- Migration: Fix Founder Dashboard RLS Policies
-- Target: orders, order_items, book_club_memberships
-- Description: Adds missing admin/founder policies to ensure dashboard data loads correctly.
-- ==========================================

BEGIN;

-- 1. Orders Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        -- Add policy for admins/founders to view all orders
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'orders' AND policyname = 'Admins can view all orders'
        ) THEN
            CREATE POLICY "Admins can view all orders" ON public.orders
                FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;

        -- Add policy for admins/founders to manage all orders
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'orders' AND policyname = 'Admins can manage all orders'
        ) THEN
            CREATE POLICY "Admins can manage all orders" ON public.orders
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 2. Order Items Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        -- Add policy for admins/founders to view all order items
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'order_items' AND policyname = 'Admins can view all order items'
        ) THEN
            CREATE POLICY "Admins can view all order items" ON public.order_items
                FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;

        -- Add policy for authors to view items for their products
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'order_items' AND policyname = 'Authors can view their product sales'
        ) THEN
            -- Check if author_id exists in products before creating policy
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'author_id') THEN
                CREATE POLICY "Authors can view their product sales" ON public.order_items
                    FOR SELECT USING (
                        EXISTS (
                            SELECT 1 FROM public.products 
                            WHERE id = order_items.product_id 
                            AND author_id = auth.uid()
                        )
                    );
            END IF;
        END IF;
    END IF;
END $$;

-- 3. Book Club Memberships Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_club_memberships') THEN
        -- Add policy for admins/founders to view all memberships
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'book_club_memberships' AND policyname = 'Admins can view all memberships'
        ) THEN
            CREATE POLICY "Admins can view all memberships" ON public.book_club_memberships
                FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 4. Partnership Applications Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partnership_applications') THEN
        -- Add policy for admins/founders to manage all partnership applications
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'partnership_applications' AND policyname = 'Admins can manage all partnership applications'
        ) THEN
            CREATE POLICY "Admins can manage all partnership applications" ON public.partnership_applications
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 5. Audit Logs Table Policies (Expand to Admin)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
        -- Drop existing restricted policy if it exists
        DROP POLICY IF EXISTS "Founders can view all audit logs" ON public.audit_logs;
        
        -- Create new policy for both admins and founders
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'audit_logs' AND policyname = 'Admins can view all audit logs'
        ) THEN
            CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
                FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 6. Newsletter Subscriptions Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'newsletter_subscriptions') THEN
        -- Ensure admins/founders can manage newsletter subscriptions
        -- The existing migration might only have SELECT/UPDATE
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'newsletter_subscriptions' AND policyname = 'Admins can manage newsletter subscriptions'
        ) THEN
            CREATE POLICY "Admins can manage newsletter subscriptions" ON public.newsletter_subscriptions
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 7. Contact Messages Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_messages') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'contact_messages' AND policyname = 'Admins can manage contact messages'
        ) THEN
            CREATE POLICY "Admins can manage contact messages" ON public.contact_messages
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 8. Author Applications Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'author_applications') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'author_applications' AND policyname = 'Admins can manage author applications'
        ) THEN
            CREATE POLICY "Admins can manage author applications" ON public.author_applications
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 9. Shipping Zones Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipping_zones') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'shipping_zones' AND policyname = 'Admins can manage shipping zones'
        ) THEN
            CREATE POLICY "Admins can manage shipping zones" ON public.shipping_zones
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 10. Promos Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promos') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'promos' AND policyname = 'Admins can manage promos'
        ) THEN
            CREATE POLICY "Admins can manage promos" ON public.promos
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 11. Partnership Agreements Table Policies (Templates)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partnership_agreements') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'partnership_agreements' AND policyname = 'Admins can manage partnership agreements'
        ) THEN
            CREATE POLICY "Admins can manage partnership agreements" ON public.partnership_agreements
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 12. Site Settings Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'site_settings') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'site_settings' AND policyname = 'Admins can manage site settings'
        ) THEN
            CREATE POLICY "Admins can manage site settings" ON public.site_settings
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 13. Fulfillment Ledger Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'fulfillment_ledger' AND policyname = 'Admins can view all fulfillment records'
        ) THEN
            CREATE POLICY "Admins can view all fulfillment records" ON public.fulfillment_ledger
                FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 14. Reviews Table Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'reviews' AND policyname = 'Admins can manage all reviews'
        ) THEN
            CREATE POLICY "Admins can manage all reviews" ON public.reviews
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

-- 15. Profiles Table Policies (Ensure Admins can see all)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'profiles' AND policyname = 'Admins can view all profiles'
        ) THEN
            CREATE POLICY "Admins can view all profiles" ON public.profiles
                FOR SELECT USING (
                    EXISTS (
                        SELECT 1 FROM public.profiles 
                        WHERE id = auth.uid() 
                        AND role IN ('admin', 'founder')
                    )
                );
        END IF;
    END IF;
END $$;

COMMIT;
