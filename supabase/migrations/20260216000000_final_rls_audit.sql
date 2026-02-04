-- ==========================================
-- Migration: Final RLS Policy Audit & Cleanup
-- Target: All tables
-- Description: Ensures consistent admin/founder access and user self-access.
-- ==========================================

BEGIN;

-- 1. Helper Function for Admin Check (to avoid repetition)
CREATE OR REPLACE FUNCTION public.is_admin_or_founder()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'founder')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply Admin Policies to all key tables
DO $$ 
DECLARE
    t text;
    tables_to_fix text[] := ARRAY[
        'agreements', 
        'partnership_agreements', 
        'author_applications', 
        'partnership_applications',
        'partnership_services',
        'transactions',
        'notification_logs',
        'event_rsvps',
        'club_discussions',
        'book_club_memberships',
        'newsletter_subscriptions',
        'contact_messages',
        'shipping_zones',
        'promos',
        'site_settings',
        'fulfillment_ledger',
        'reviews',
        'profiles',
        'ebook_metadata'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_fix LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP POLICY IF EXISTS "Admins manage %I" ON public.%I', t, t);
            EXECUTE format('CREATE POLICY "Admins manage %I" ON public.%I FOR ALL USING (public.is_admin_or_founder())', t, t);
        END IF;
    END LOOP;
END $$;

-- 3. Specific User Policies (Self-Access)
DO $$ 
BEGIN
    -- Agreements: Users can view and update (for signing) their own
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agreements') THEN
        DROP POLICY IF EXISTS "Users can view own agreements" ON public.agreements;
        CREATE POLICY "Users can view own agreements" ON public.agreements FOR SELECT USING (auth.uid() = partner_id);
        
        DROP POLICY IF EXISTS "Users can update own agreements" ON public.agreements;
        CREATE POLICY "Users can update own agreements" ON public.agreements FOR UPDATE USING (auth.uid() = partner_id);
    END IF;

    -- Applications: Users can view their own
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'author_applications') THEN
        DROP POLICY IF EXISTS "Users can view own author apps" ON public.author_applications;
        CREATE POLICY "Users can view own author apps" ON public.author_applications FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partnership_applications') THEN
        DROP POLICY IF EXISTS "Users can view own partner apps" ON public.partnership_applications;
        CREATE POLICY "Users can view own partner apps" ON public.partnership_applications FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- Transactions: Users can view their own
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
        DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
        CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- Event RSVPs: Users can manage their own
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_rsvps') THEN
        DROP POLICY IF EXISTS "Users can manage own rsvps" ON public.event_rsvps;
        CREATE POLICY "Users can manage own rsvps" ON public.event_rsvps FOR ALL USING (auth.uid() = user_id);
    END IF;

    -- Club Discussions: Users can manage their own
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'club_discussions') THEN
        DROP POLICY IF EXISTS "Users can manage own discussions" ON public.club_discussions;
        CREATE POLICY "Users can manage own discussions" ON public.club_discussions FOR ALL USING (auth.uid() = author_id);
    END IF;

    -- Book Club Memberships: Users can view their own
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_club_memberships') THEN
        DROP POLICY IF EXISTS "Users can view own memberships" ON public.book_club_memberships;
        CREATE POLICY "Users can view own memberships" ON public.book_club_memberships FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Enable RLS on all tables (just in case)
DO $$ 
DECLARE
    t text;
    tables_to_enable text[] := ARRAY[
        'agreements', 
        'partnership_agreements', 
        'author_applications', 
        'partnership_applications',
        'partnership_services',
        'transactions',
        'notification_logs',
        'event_rsvps',
        'club_discussions',
        'book_club_memberships',
        'newsletter_subscriptions',
        'contact_messages',
        'shipping_zones',
        'promos',
        'site_settings',
        'fulfillment_ledger',
        'reviews',
        'profiles',
        'ebook_metadata'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_enable LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        END IF;
    END LOOP;
END $$;

COMMIT;
