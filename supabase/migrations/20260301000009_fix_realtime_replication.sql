-- Fix Realtime Replication for Founder Dashboard
-- This migration ensures that all necessary tables are added to the supabase_realtime publication
-- and that they have REPLICA IDENTITY FULL for complete data synchronization.

BEGIN;

-- 1. Ensure REPLICA IDENTITY FULL for all relevant tables
-- This is necessary for Realtime to send the complete row data for all events
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.cms_content REPLICA IDENTITY FULL;
ALTER TABLE public.shipping_zones REPLICA IDENTITY FULL;
ALTER TABLE public.author_applications REPLICA IDENTITY FULL;
ALTER TABLE public.partnership_applications REPLICA IDENTITY FULL;
ALTER TABLE public.partnership_agreements REPLICA IDENTITY FULL;
ALTER TABLE public.contact_messages REPLICA IDENTITY FULL;
ALTER TABLE public.newsletter_subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;

-- 2. Ensure tables are in the supabase_realtime publication
-- We use a safer way to add tables to the publication
DO $$
DECLARE
  tables_to_add TEXT[] := ARRAY[
    'profiles', 'orders', 'products', 'cms_content', 'shipping_zones', 
    'author_applications', 'partnership_applications', 'partnership_agreements',
    'contact_messages', 'newsletter_subscriptions', 'events', 'audit_logs'
  ];
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(tables_to_add) LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN
        -- Table is already in the publication, ignore
        NULL;
      WHEN OTHERS THEN
        -- Log or ignore other errors
        RAISE NOTICE 'Could not add table % to supabase_realtime publication: %', t, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
