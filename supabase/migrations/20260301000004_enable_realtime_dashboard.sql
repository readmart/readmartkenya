-- Enable Realtime for Founder Dashboard tables
-- We use DO block to avoid errors if they are already added

BEGIN;

DO $$
BEGIN
  -- Core Tables
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_content';
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shipping_zones';
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.products';
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.events';
  
  -- Communication Tables
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_messages';
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.newsletter_subscriptions';
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs';
  
  -- Application/Partnership Tables
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.author_applications';
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.partnership_applications';
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.partnership_agreements';
EXCEPTION
  WHEN duplicate_object THEN NULL; -- Ignore if already exists
  WHEN OTHERS THEN NULL; -- Ignore other errors (like table not found, though they should exist)
END $$;

COMMIT;
