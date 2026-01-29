-- ==========================================
-- Migration: Enhance Newsletter System
-- Target: newsletter_subscriptions
-- Description: Update status options and add tracking columns
-- ==========================================

BEGIN;

-- 1. Update status check constraint
-- First, drop the old constraint if it exists
DO $$ 
BEGIN 
    ALTER TABLE public.newsletter_subscriptions DROP CONSTRAINT IF EXISTS newsletter_subscriptions_status_check;
END $$;

-- 2. Add new status options and check constraint
ALTER TABLE public.newsletter_subscriptions 
    ALTER COLUMN status SET DEFAULT 'unconfirmed',
    ADD CONSTRAINT newsletter_subscriptions_status_check 
    CHECK (status IN ('active', 'unconfirmed', 'unsubscribed', 'paused', 'deleted'));

-- 3. Add behavior tracking columns
ALTER TABLE public.newsletter_subscriptions 
    ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website',
    ADD COLUMN IF NOT EXISTS subscription_type TEXT DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS open_rate FLOAT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS click_rate FLOAT DEFAULT 0;

-- 4. Create an audit log for newsletter actions
CREATE TABLE IF NOT EXISTS public.newsletter_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES public.newsletter_subscriptions(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'subscribe', 'unsubscribe', 'status_change', 'email_sent', 'email_opened', 'link_clicked'
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable RLS on logs
ALTER TABLE public.newsletter_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for logs
CREATE POLICY "Admins can view newsletter logs" ON public.newsletter_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'founder')
        )
    );

COMMIT;
