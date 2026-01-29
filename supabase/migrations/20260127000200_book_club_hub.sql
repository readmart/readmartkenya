-- ==========================================
-- Migration: Book Club Hub Comprehensive Schema
-- Target: clubs, members, books, discussions, polls, events
-- ==========================================

BEGIN;

-- 1. Book Clubs Table
CREATE TABLE IF NOT EXISTS public.book_clubs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    genre text,
    image_url text,
    is_public boolean DEFAULT true,
    require_approval boolean DEFAULT false,
    meeting_frequency text, -- 'weekly', 'biweekly', 'monthly'
    meeting_format text, -- 'online', 'in-person', 'hybrid'
    meeting_platform text, -- 'Zoom', 'Google Meet', 'Discord', etc.
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Book Club Members Table
CREATE TABLE IF NOT EXISTS public.book_club_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.book_clubs(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'invited', 'banned')),
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(club_id, user_id)
);

-- 3. Book Club Books (Reading List)
CREATE TABLE IF NOT EXISTS public.book_club_books (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.book_clubs(id) ON DELETE CASCADE NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    title text NOT NULL,
    author text,
    status text DEFAULT 'upcoming' CHECK (status IN ('reading', 'finished', 'upcoming')),
    start_date date,
    end_date date,
    progress_tracking jsonb DEFAULT '[]'::jsonb, -- Array of milestones
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Book Club Discussions (Forum Style)
CREATE TABLE IF NOT EXISTS public.book_club_discussions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.book_clubs(id) ON DELETE CASCADE NOT NULL,
    author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    is_pinned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Book Club Discussion Comments
CREATE TABLE IF NOT EXISTS public.book_club_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    discussion_id uuid REFERENCES public.book_club_discussions(id) ON DELETE CASCADE NOT NULL,
    author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    parent_id uuid REFERENCES public.book_club_comments(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Book Club Polls
CREATE TABLE IF NOT EXISTS public.book_club_polls (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.book_clubs(id) ON DELETE CASCADE NOT NULL,
    question text NOT NULL,
    options jsonb NOT NULL, -- Array of strings
    expires_at timestamp with time zone,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Book Club Poll Votes
CREATE TABLE IF NOT EXISTS public.book_club_poll_votes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id uuid REFERENCES public.book_club_polls(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    option_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(poll_id, user_id)
);

-- 8. Book Club Events
CREATE TABLE IF NOT EXISTS public.book_club_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.book_clubs(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    description text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    location text, -- URL for online, address for in-person
    event_type text CHECK (event_type IN ('meeting', 'author_discussion', 'social', 'other')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Clubs: Anyone can view public clubs, members can view private clubs
CREATE POLICY "Public clubs are viewable by everyone" ON public.book_clubs
    FOR SELECT USING (is_public = true AND is_active = true);

CREATE POLICY "Members can view their private clubs" ON public.book_clubs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.book_club_members 
            WHERE club_id = book_clubs.id AND user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Admins can manage their clubs" ON public.book_clubs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.book_club_members 
            WHERE club_id = book_clubs.id AND user_id = auth.uid() AND role = 'admin'
        )
    );

-- Members: Members can view each other
CREATE POLICY "Members can view club membership" ON public.book_club_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.book_club_members m
            WHERE m.club_id = book_club_members.club_id AND m.user_id = auth.uid() AND m.status = 'active'
        )
        OR 
        EXISTS (
            SELECT 1 FROM public.book_clubs c
            WHERE c.id = book_club_members.club_id AND c.is_public = true
        )
    );

-- Discussions, Books, Events: Only active members can view/interact
CREATE POLICY "Members can view club content" ON public.book_club_discussions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.book_club_members 
            WHERE club_id = book_club_discussions.club_id AND user_id = auth.uid() AND status = 'active'
        )
    );

CREATE POLICY "Members can post discussions" ON public.book_club_discussions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.book_club_members 
            WHERE club_id = book_club_discussions.club_id AND user_id = auth.uid() AND status = 'active'
        )
    );

-- Comments follow discussions
CREATE POLICY "Members can view comments" ON public.book_club_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.book_club_discussions d
            JOIN public.book_club_members m ON m.club_id = d.club_id
            WHERE d.id = book_club_comments.discussion_id AND m.user_id = auth.uid() AND m.status = 'active'
        )
    );

COMMIT;
