-- ==========================================
-- Migration: Comprehensive Storage, Schema & Security Fixes
-- ==========================================

BEGIN;

-- 1. Create Storage Buckets (via storage extension if available, otherwise manual setup required)
-- Note: In standard SQL, we can't always create buckets, but we can try inserting into storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('products', 'products', true),
    ('ebooks', 'ebooks', false),
    ('partnership_documents', 'partnership_documents', false),
    ('avatars', 'avatars', true),
    ('banners', 'banners', true),
    ('settings', 'settings', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Policies
-- Products Bucket (Public Read, Admin Write)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Admin Full Access" ON storage.objects FOR ALL USING (
    bucket_id = 'products' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')))
);

-- Ebooks Bucket (Owner/Admin Read, Admin Write)
CREATE POLICY "Owner/Admin Access" ON storage.objects FOR SELECT USING (
    bucket_id = 'ebooks' AND 
    (auth.uid() IN (SELECT user_id FROM public.club_members WHERE status = 'active') OR 
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')))
);
CREATE POLICY "Admin Write Access" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'ebooks' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')))
);

-- 3. Enhance contact_messages for departments
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS department text DEFAULT 'General';
ALTER TABLE public.contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_status_check 
    CHECK (status IN ('pending', 'read', 'replied', 'resolved'));

-- 4. Create events table if not exists (using dedicated table instead of cms_content for better structure)
CREATE TABLE IF NOT EXISTS public.events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    image_url text,
    event_date timestamp with time zone NOT NULL,
    location text,
    type text DEFAULT 'offline' CHECK (type IN ('online', 'offline')),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. RLS for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view active events" ON public.events;
CREATE POLICY "Public can view active events" ON public.events
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Founders can manage events" ON public.events;
CREATE POLICY "Founders can manage events" ON public.events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'founder'
        )
    );

-- 6. Ensure site_settings has all required identity fields
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS site_name text DEFAULT 'ReadMart',
ADD COLUMN IF NOT EXISTS site_logo text,
ADD COLUMN IF NOT EXISTS whatsapp_link text,
ADD COLUMN IF NOT EXISTS contact_email text,
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS x_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS youtube_url text,
ADD COLUMN IF NOT EXISTS threads_url text;

-- 7. Add Membership Wall fields to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS membership_wall_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS membership_price decimal(12,2) DEFAULT 1000.00,
ADD COLUMN IF NOT EXISTS membership_duration_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS membership_title text DEFAULT 'ReadMart Premium Member',
ADD COLUMN IF NOT EXISTS membership_description text DEFAULT 'Get exclusive access to book clubs, insights, and early bird events.';

-- 8. Add Hero Section fields to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS hero_headline text DEFAULT 'EVERY PAGE TELLS A STORY',
ADD COLUMN IF NOT EXISTS hero_subtext text DEFAULT 'Discover a curated sanctuary for bibliophiles and art enthusiasts.',
ADD COLUMN IF NOT EXISTS hero_image_url text;

-- 9. Trigger for automatic M-Pesa order confirmation (mockup/placeholder for actual logic)
-- In a real scenario, this would be updated by a webhook from M-Pesa
CREATE OR REPLACE FUNCTION public.handle_mpesa_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changes to 'paid' in a hypothetical payments table, update the order
    -- This is a simplified example
    UPDATE public.orders 
    SET status = 'paid', updated_at = now()
    WHERE id = NEW.order_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
