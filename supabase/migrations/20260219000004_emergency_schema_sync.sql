
-- ==========================================
-- Migration: Emergency Schema Sync
-- Description: Ensures all tables and columns from previous migrations exist and forces schema reload
-- ==========================================

BEGIN;

-- 1. Ensure newsletter_subscriptions table exists
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS if not already enabled
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Re-create policies safely
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscriptions;
CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscriptions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view newsletter subscriptions" ON public.newsletter_subscriptions;
CREATE POLICY "Admins can view newsletter subscriptions" ON public.newsletter_subscriptions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'founder'))
);

-- 2. Ensure site_settings Author of the Day columns and relationships
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_id') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_id uuid REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_enabled') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_enabled boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_books') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_books uuid[] DEFAULT '{}';
    END IF;
END $$;

-- 3. Ensure profiles role constraint includes 'author'
DO $$ 
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('customer', 'admin', 'founder', 'author', 'partner'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not update profiles role check constraint';
END $$;

-- 4. Fix potential product 400 error by ensuring common columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'author_id') THEN
        ALTER TABLE public.products ADD COLUMN author_id uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- 5. Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
