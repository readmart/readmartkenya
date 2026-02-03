-- Fix Realtime Replication for Founder Dashboard
-- This migration ensures that all necessary tables are added to the supabase_realtime publication
-- and that they have REPLICA IDENTITY FULL for complete data synchronization.

BEGIN;

-- 1. Ensure REPLICA IDENTITY FULL for all relevant tables
-- We use a DO block to handle cases where some tables might not exist yet
DO $$
DECLARE
  tables_to_alter TEXT[] := ARRAY[
    'profiles', 'orders', 'products', 'cms_content', 'shipping_zones', 
    'author_applications', 'partnership_applications', 'partnership_agreements',
    'contact_messages', 'newsletter_subscriptions', 'events', 'audit_logs',
    'book_clubs', 'book_club_events', 'book_club_discussions'
  ];
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(tables_to_alter) LOOP
    -- Check if table exists before altering
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    ELSE
      RAISE NOTICE 'Table public.% does not exist, skipping REPLICA IDENTITY alteration.', t;
    END IF;
  END LOOP;
END $$;

-- 2. Ensure tables are in the supabase_realtime publication
-- We use a safer way to add tables to the publication
DO $$
DECLARE
  tables_to_add TEXT[] := ARRAY[
    'profiles', 'orders', 'products', 'cms_content', 'shipping_zones', 
    'author_applications', 'partnership_applications', 'partnership_agreements',
    'contact_messages', 'newsletter_subscriptions', 'events', 'audit_logs',
    'book_clubs', 'book_club_events', 'book_club_discussions'
  ];
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(tables_to_add) LOOP
    -- Check if table exists before adding to publication
    IF EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION
        WHEN duplicate_object THEN
          -- Table is already in the publication, ignore
          NULL;
        WHEN OTHERS THEN
          -- Log other errors
          RAISE NOTICE 'Could not add table % to supabase_realtime publication: %', t, SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'Table public.% does not exist, skipping addition to publication.', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
