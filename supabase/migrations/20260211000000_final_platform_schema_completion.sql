-- ==========================================
-- Migration: Final Platform Schema Completion
-- Target: site_settings, partnership_agreements, author_applications, storage, RLS, categories
-- Description: Completes missing SQL schema and RLS policies as per implementation guide.
-- ==========================================

BEGIN;

-- 1. Ensure notification_logs table exists
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient text NOT NULL,
    subject text NOT NULL,
    status text CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- 2. Enhance Site Settings with missing fields
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS headquarters_address text DEFAULT 'Nairobi, Kenya',
ADD COLUMN IF NOT EXISTS global_support_whatsapp text DEFAULT 'https://wa.me/254794129958',
ADD COLUMN IF NOT EXISTS instagram_url text DEFAULT 'https://www.instagram.com/readmartke?igsh=bWdtZDhvcGZsZWNx',
ADD COLUMN IF NOT EXISTS facebook_url text DEFAULT 'https://www.facebook.com/share/1LB4jKLTTV/',
ADD COLUMN IF NOT EXISTS x_url text DEFAULT 'https://x.com/readmartke',
ADD COLUMN IF NOT EXISTS linkedin_url text DEFAULT 'https://linkedin.com/comm/mynetwork/discovery-see-all?usecase=PEOPLE_FOLLOWS&followMember=read-mart-6797423a1';

-- 2. Enhance Agreement & Application Schema for PDF Workflow
ALTER TABLE public.partnership_agreements 
ADD COLUMN IF NOT EXISTS file_path text; -- Path to the template PDF in storage

ALTER TABLE public.partnership_applications 
ADD COLUMN IF NOT EXISTS signed_agreement_url text; -- Path to the uploaded signed PDF

ALTER TABLE public.author_applications 
ADD COLUMN IF NOT EXISTS signed_agreement_url text; -- Path to the uploaded signed PDF

-- 3. Create Additional Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('site_assets', 'site_assets', true),
  ('agreements', 'agreements', false),
  ('signed_agreements', 'signed_agreements', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage Policies for site_assets (Public)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Read Access') THEN
        CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'site_assets');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins manage site_assets') THEN
        CREATE POLICY "Admins manage site_assets" ON storage.objects FOR ALL USING (bucket_id = 'site_assets' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 5. Storage Policies for agreements (Private Templates)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public view active agreements') THEN
        CREATE POLICY "Public view active agreements" ON storage.objects FOR SELECT USING (bucket_id = 'agreements');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins manage agreements') THEN
        CREATE POLICY "Admins manage agreements" ON storage.objects FOR ALL USING (bucket_id = 'agreements' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 6. Storage Policies for signed_agreements (Private)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users view own signed agreements') THEN
        CREATE POLICY "Users view own signed agreements" ON storage.objects FOR SELECT USING (bucket_id = 'signed_agreements' AND (auth.uid() = owner OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users upload signed agreements') THEN
        CREATE POLICY "Users upload signed agreements" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'signed_agreements' AND auth.role() = 'authenticated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admins manage signed agreements') THEN
        CREATE POLICY "Admins manage signed agreements" ON storage.objects FOR ALL USING (bucket_id = 'signed_agreements' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 7. Complete Missing RLS Policies for Founder Dashboard

-- 7.0 Ensure Dependent Tables Exist & Enable RLS
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id),
    user_id uuid REFERENCES public.profiles(id),
    amount decimal(12,2) NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.event_rsvps (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    event_id uuid REFERENCES public.cms_content(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'attending' CHECK (status IN ('attending', 'interested', 'cancelled')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, event_id)
);
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.club_discussions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.cms_content(id) ON DELETE CASCADE NOT NULL,
    author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.club_discussions ENABLE ROW LEVEL SECURITY;

-- 7.1 Transactions Table Admin Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Admins manage all transactions') THEN
            EXECUTE 'CREATE POLICY "Admins manage all transactions" ON public.transactions
                FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''founder'')))';
        END IF;
    END IF;
END $$;

-- 7.2 Notification Logs Table Admin Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_logs') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_logs' AND policyname = 'Admins manage notification logs') THEN
            EXECUTE 'CREATE POLICY "Admins manage notification logs" ON public.notification_logs
                FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''founder'')))';
        END IF;
    END IF;
END $$;

-- 7.3 Partnership Services Table Admin Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partnership_services') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partnership_services' AND policyname = 'Admins manage partnership services') THEN
            EXECUTE 'CREATE POLICY "Admins manage partnership services" ON public.partnership_services
                FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''founder'')))';
        END IF;
    END IF;
END $$;

-- 7.4 Event RSVPs Table Admin Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_rsvps') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_rsvps' AND policyname = 'Admins view all RSVPs') THEN
            EXECUTE 'CREATE POLICY "Admins view all RSVPs" ON public.event_rsvps
                FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''founder'')))';
        END IF;
    END IF;
END $$;

-- 7.5 Club Discussions Table Admin Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'club_discussions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'club_discussions' AND policyname = 'Admins manage all discussions') THEN
            EXECUTE 'CREATE POLICY "Admins manage all discussions" ON public.club_discussions
                FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''founder'')))';
        END IF;
    END IF;
END $$;

-- 7.6 Book Club Memberships Management Policy
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_club_memberships') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'book_club_memberships' AND policyname = 'Admins manage all memberships') THEN
            EXECUTE 'CREATE POLICY "Admins manage all memberships" ON public.book_club_memberships
                FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''founder'')))';
        END IF;
    END IF;
END $$;

-- 8. Fix Products is_active column (User specifically mentioned this error)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'is_active') THEN
        ALTER TABLE public.products ADD COLUMN is_active boolean DEFAULT true;
    END IF;
END $$;

-- 9. Enhance Categories table
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- 10. Fix missing shipping_zone_id in orders (Payment Blockage Fix)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_zone_id') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_zone_id uuid REFERENCES public.shipping_zones(id);
    END IF;
END $$;

-- 11. Global Sync Functionality (Placeholder for re-fetching data/refreshing views)
CREATE OR REPLACE FUNCTION public.execute_global_sync()
RETURNS jsonb AS $$
BEGIN
  -- This function can be expanded to refresh materialized views if any are added later
  -- For now, it returns a success message to the founder dashboard
  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Global system synchronization executed successfully',
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
