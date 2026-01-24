-- ==========================================
-- Migration: Event RSVPs and Club Discussions
-- ==========================================

BEGIN;

-- 1. Create event_rsvps table
CREATE TABLE IF NOT EXISTS public.event_rsvps (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    event_id uuid REFERENCES public.cms_content(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'attending' CHECK (status IN ('attending', 'interested', 'cancelled')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, event_id)
);

-- 2. Create club_discussions table (for updates/announcements within a club)
CREATE TABLE IF NOT EXISTS public.club_discussions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.cms_content(id) ON DELETE CASCADE NOT NULL,
    author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    image_url text,
    is_pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_discussions ENABLE ROW LEVEL SECURITY;

-- 4. Policies for event_rsvps
CREATE POLICY "Users can view their own RSVPs" ON public.event_rsvps
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can RSVP to events" ON public.event_rsvps
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own RSVPs" ON public.event_rsvps
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Founders and admins can view all RSVPs" ON public.event_rsvps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

-- 5. Policies for club_discussions
CREATE POLICY "Club members can view discussions" ON public.club_discussions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.book_club_memberships
            WHERE user_id = auth.uid()
            AND club_id = club_discussions.club_id
            AND is_active = true
        ) OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'founder')
        )
    );

CREATE POLICY "Founders and admins can manage discussions" ON public.club_discussions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'founder')
        )
    );

COMMIT;
