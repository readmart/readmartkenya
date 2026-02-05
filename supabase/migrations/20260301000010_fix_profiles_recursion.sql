-- Migration: Fix Profiles RLS Recursion
-- Description: Replaces recursive policies on the profiles table with a SECURITY DEFINER function check.

BEGIN;

-- 1. Ensure the helper function exists and is SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.is_admin_or_founder()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'founder')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Fix the SELECT policy on profiles (the primary source of recursion)
DROP POLICY IF EXISTS "Profiles are viewable by owner or admin" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Profiles are viewable by owner or admin" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id 
        OR public.is_admin_or_founder()
    );

-- 3. Fix the UPDATE policy on profiles
DROP POLICY IF EXISTS "Admins/Founders can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

CREATE POLICY "Admins/Founders can update all profiles" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id 
        OR public.is_admin_or_founder()
    );

-- 4. Fix the DELETE policy on profiles (if any)
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
    FOR DELETE USING (public.is_admin_or_founder());

-- 5. Fix the INSERT policy on profiles
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Storage: Fix Admin access to storage buckets to use the helper function
-- This prevents storage policies from being affected by profiles RLS and improves performance.
DO $$ 
DECLARE
    b text;
    buckets text[] := ARRAY['products', 'site_assets', 'banners', 'ebooks', 'agreements', 'signed_agreements', 'partnership_documents', 'contact_attachments', 'avatars'];
BEGIN
    FOREACH b IN ARRAY buckets LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admin Full Access to %I" ON storage.objects', b);
        EXECUTE format('DROP POLICY IF EXISTS "Admins manage %I" ON storage.objects', b);
        
        EXECUTE format('CREATE POLICY "Admins manage %I" ON storage.objects 
            FOR ALL TO authenticated 
            USING (bucket_id = %L AND public.is_admin_or_founder())
            WITH CHECK (bucket_id = %L AND public.is_admin_or_founder())', b, b, b);
    END LOOP;
END $$;

-- 7. Global Sweep: Ensure all "Admins manage" policies on public tables use the helper function
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

COMMIT;
