-- ==========================================
-- FINAL REALTIME & RLS RECOVERY SCRIPT
-- Resolves CHANNEL_ERROR in Founder Dashboard and ensures full data sync
-- ==========================================

BEGIN;

-- 1. Ensure the helper function exists and is SECURITY DEFINER
-- This is critical for bypassing RLS during role checks and preventing recursion
CREATE OR REPLACE FUNCTION public.is_admin_or_founder()
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  -- Get the role directly from the profiles table
  -- SECURITY DEFINER ensures this bypasses RLS on the profiles table itself
  SELECT role INTO user_role FROM public.profiles WHERE id = auth.uid();
  RETURN user_role IN ('admin', 'founder');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Ensure supabase_realtime publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Publication supabase_realtime might already exist or could not be created: %', SQLERRM;
END $$;

-- 3. Consolidated Realtime Setup: REPLICA IDENTITY + Publication
DO $$
DECLARE
  tables_to_fix TEXT[] := ARRAY[
    'profiles', 'orders', 'products', 'legacy_cms_content', 'shipping_zones', 
    'author_applications', 'partnership_applications', 'partnership_agreements',
    'contact_messages', 'newsletter_subscriptions', 'events', 'audit_logs',
    'book_clubs', 'book_club_events', 'book_club_discussions', 'banners', 'announcements',
    'fulfillment_ledger', 'transactions', 'agreements', 'partnership_services',
    'event_rsvps', 'newsletter_subscriptions', 'reviews', 'ebook_metadata',
    'cms_content', 'categories', 'order_items', 'partners', 'book_club_members'
  ];
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(tables_to_fix) LOOP
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      -- Set REPLICA IDENTITY FULL for complete Realtime payloads
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      
      -- Add to publication
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION
        WHEN duplicate_object THEN NULL; -- Already in publication
        WHEN OTHERS THEN RAISE NOTICE 'Error adding % to publication: %', t, SQLERRM;
      END;
      
      -- Ensure Admin/Founder has full RLS access
      EXECUTE format('DROP POLICY IF EXISTS "Admins manage %I" ON public.%I', t, t);
      EXECUTE format('CREATE POLICY "Admins manage %I" ON public.%I FOR ALL USING (public.is_admin_or_founder())', t, t);
    ELSE
      RAISE NOTICE 'Table public.% does not exist, skipping.', t;
    END IF;
  END LOOP;
END $$;

-- 4. Specific fix for Profiles SELECT policy (critical for Realtime subscription)
-- If an admin cannot SELECT a profile, they cannot subscribe to its changes
DO $$
BEGIN
    DROP POLICY IF EXISTS "Profiles are viewable by owner or admin" ON public.profiles;
    CREATE POLICY "Profiles are viewable by owner or admin" ON public.profiles
        FOR SELECT USING (
            auth.uid() = id 
            OR public.is_admin_or_founder()
        );
END $$;

-- 5. Unified Storage Security: Apply is_admin_or_founder() to all buckets
-- This ensures admins can always manage files regardless of bucket-specific RLS
DO $$ 
DECLARE
    b text;
    buckets text[] := ARRAY['products', 'site_assets', 'banners', 'ebooks', 'agreements', 'signed_agreements', 'partnership_documents', 'contact_attachments', 'avatars'];
BEGIN
    FOREACH b IN ARRAY buckets LOOP
        -- Remove old policy if it exists
        EXECUTE format('DROP POLICY IF EXISTS "Admins manage %I" ON storage.objects', b);
        
        -- Create unified policy using the SECURITY DEFINER helper
        EXECUTE format('CREATE POLICY "Admins manage %I" ON storage.objects 
            FOR ALL TO authenticated 
            USING (bucket_id = %L AND public.is_admin_or_founder())
            WITH CHECK (bucket_id = %L AND public.is_admin_or_founder())', b, b, b);
    END LOOP;
END $$;

-- 6. Force PostgREST to reload schema to reflect all changes
NOTIFY pgrst, 'reload schema';

COMMIT;
