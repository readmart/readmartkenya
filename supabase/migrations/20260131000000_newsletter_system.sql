-- ==========================================
-- Migration: Newsletter Subscription System
-- Target: newsletter_subscriptions
-- Description: Table for storing newsletter subscribers
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
CREATE POLICY "Anyone can subscribe to newsletter" ON public.newsletter_subscriptions
    FOR INSERT WITH CHECK (true);

-- Only admins/founders can view the list
CREATE POLICY "Admins can view newsletter subscriptions" ON public.newsletter_subscriptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'founder')
        )
    );

-- Only admins/founders can update subscriptions
CREATE POLICY "Admins can update newsletter subscriptions" ON public.newsletter_subscriptions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'founder')
        )
    );

-- 4. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_newsletter_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_newsletter_subscriptions_updated_at
    BEFORE UPDATE ON public.newsletter_subscriptions
    FOR EACH ROW
    EXECUTE PROCEDURE update_newsletter_updated_at_column();

COMMIT;
