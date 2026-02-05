-- ==========================================
-- Migration: Kill Polymorphic cms_content
-- Split into: book_clubs (already exists), events (already exists), banners, announcements
-- ==========================================

BEGIN;

-- 1. Create banners table
CREATE TABLE IF NOT EXISTS public.banners (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    image_url text,
    link_url text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    published_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Banners are viewable by everyone" ON public.banners
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage banners" ON public.banners
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));

CREATE POLICY "Announcements are viewable by everyone" ON public.announcements
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage announcements" ON public.announcements
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));

-- 5. Migrate Data from cms_content
-- Migrate book clubs
INSERT INTO public.book_clubs (id, name, description, image_url, is_active, metadata, created_at)
SELECT id, title, content, image_url, is_active, metadata, created_at
FROM public.cms_content
WHERE type = 'book_club'
ON CONFLICT (id) DO NOTHING;

-- Migrate events
INSERT INTO public.events (id, title, description, image_url, event_date, is_active, created_at)
SELECT id, title, content, image_url, COALESCE((metadata->>'date')::timestamp with time zone, now()), is_active, created_at
FROM public.cms_content
WHERE type = 'event'
ON CONFLICT (id) DO NOTHING;

-- Migrate banners
INSERT INTO public.banners (id, title, content, image_url, link_url, is_active, metadata, published_at, created_at)
SELECT id, title, content, image_url, link_url, is_active, metadata, published_at, created_at
FROM public.cms_content
WHERE type = 'banner'
ON CONFLICT (id) DO NOTHING;

-- Migrate announcements
INSERT INTO public.announcements (id, title, content, is_active, metadata, created_at)
SELECT id, title, content, is_active, metadata, created_at
FROM public.cms_content
WHERE type = 'announcement'
ON CONFLICT (id) DO NOTHING;

-- 6. Update Foreign Keys
-- Update event_rsvps to point to events table
ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_event_id_fkey;
ALTER TABLE public.event_rsvps ADD CONSTRAINT event_rsvps_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Update club_discussions to point to book_clubs table
ALTER TABLE public.club_discussions DROP CONSTRAINT IF EXISTS club_discussions_club_id_fkey;
ALTER TABLE public.club_discussions ADD CONSTRAINT club_discussions_club_id_fkey 
    FOREIGN KEY (club_id) REFERENCES public.book_clubs(id) ON DELETE CASCADE;

-- Update book_club_memberships (legacy) to point to book_clubs table
ALTER TABLE public.book_club_memberships DROP CONSTRAINT IF EXISTS book_club_memberships_club_id_fkey;
ALTER TABLE public.book_club_memberships ADD CONSTRAINT book_club_memberships_club_id_fkey 
    FOREIGN KEY (club_id) REFERENCES public.book_clubs(id) ON DELETE CASCADE;

-- 7. Drop cms_content (Keep it for now but rename it to legacy_cms_content just in case)
ALTER TABLE public.cms_content RENAME TO legacy_cms_content;

COMMIT;
