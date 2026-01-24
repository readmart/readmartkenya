-- ==========================================
-- Migration: Newsletter Subscription System Fix
-- Target: newsletter_subscriptions
-- Description: Ensures the newsletter table exists and has the correct policies
-- ==========================================

BEGIN;

-- 1. Create Newsletter Subscriptions table
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Anyone can subscribe (insert)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'newsletter_subscriptions' 
        AND policyname = 'Anyone can subscribe to newsletter'
    ) THEN
        CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscriptions
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- Only admins/founders can view the list
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'newsletter_subscriptions' 
        AND policyname = 'Admins can view newsletter subscriptions'
    ) THEN
        CREATE POLICY "Admins can view newsletter subscriptions" ON public.newsletter_subscriptions
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- Only admins/founders can update subscriptions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'newsletter_subscriptions' 
        AND policyname = 'Admins can update newsletter subscriptions'
    ) THEN
        CREATE POLICY "Admins can update newsletter subscriptions" ON public.newsletter_subscriptions
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'founder')
                )
            );
    END IF;
END $$;

-- 4. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_newsletter_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_newsletter_subscriptions_updated_at ON public.newsletter_subscriptions;
CREATE TRIGGER update_newsletter_subscriptions_updated_at
    BEFORE UPDATE ON public.newsletter_subscriptions
    FOR EACH ROW
    EXECUTE PROCEDURE update_newsletter_updated_at_column();

COMMIT;
