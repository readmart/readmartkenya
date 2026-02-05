-- ==========================================
-- Migration: Author First-Class Domain
-- Description: Elevates authors from a simple role to a rich domain with earnings, payouts, drops, and fan subscriptions.
-- ==========================================

BEGIN;

-- 1. Authors Table (Extends Profile with domain-specific data)
CREATE TABLE IF NOT EXISTS public.authors (
    id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    display_name text,
    pen_name text,
    website_url text,
    social_links jsonb DEFAULT '{}'::jsonb, -- { twitter, instagram, linkedin, etc }
    is_verified boolean DEFAULT false,
    rating decimal(3,2) DEFAULT 0,
    total_books integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Author Earnings Table (Real-time balance tracking)
CREATE TABLE IF NOT EXISTS public.author_earnings (
    author_id uuid PRIMARY KEY REFERENCES public.authors(id) ON DELETE CASCADE,
    current_balance decimal(12,2) DEFAULT 0.00,
    total_earned decimal(12,2) DEFAULT 0.00,
    total_withdrawn decimal(12,2) DEFAULT 0.00,
    pending_payouts decimal(12,2) DEFAULT 0.00,
    last_payout_at timestamp with time zone,
    currency text DEFAULT 'KES',
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Author Payouts Table (Structured payout history)
CREATE TABLE IF NOT EXISTS public.author_payouts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id uuid REFERENCES public.authors(id) ON DELETE CASCADE NOT NULL,
    amount decimal(12,2) NOT NULL,
    status text CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    payout_method text DEFAULT 'm-pesa',
    payout_details jsonb DEFAULT '{}'::jsonb, -- { phone_number, account_name, provider_ref }
    processed_at timestamp with time zone,
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Author Drops Table (New releases and exclusive announcements)
CREATE TABLE IF NOT EXISTS public.author_drops (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id uuid REFERENCES public.authors(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    image_url text,
    drop_type text CHECK (drop_type IN ('new_release', 'exclusive_preview', 'announcement', 'event')) DEFAULT 'new_release',
    is_public boolean DEFAULT true,
    scheduled_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Author Subscriptions Table (Fan memberships)
CREATE TABLE IF NOT EXISTS public.author_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    author_id uuid REFERENCES public.authors(id) ON DELETE CASCADE NOT NULL,
    subscriber_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    tier text DEFAULT 'fan' CHECK (tier IN ('fan', 'superfan', 'patron')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    amount decimal(12,2) DEFAULT 0.00,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(author_id, subscriber_id)
);

-- 6. RLS Policies

ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_subscriptions ENABLE ROW LEVEL SECURITY;

-- 6.1 Authors Policies
CREATE POLICY "Authors are viewable by everyone" ON public.authors FOR SELECT USING (true);
CREATE POLICY "Authors can update their own profile" ON public.authors FOR UPDATE USING (auth.uid() = id);

-- 6.2 Earnings Policies
CREATE POLICY "Authors can view their own earnings" ON public.author_earnings FOR SELECT USING (auth.uid() = author_id);
CREATE POLICY "Admins can view all earnings" ON public.author_earnings FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
);

-- 6.3 Payouts Policies
CREATE POLICY "Authors can view their own payouts" ON public.author_payouts FOR SELECT USING (auth.uid() = author_id);
CREATE POLICY "Authors can request payouts" ON public.author_payouts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Admins can manage all payouts" ON public.author_payouts FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
);

-- 6.4 Drops Policies
CREATE POLICY "Drops are viewable by everyone" ON public.author_drops FOR SELECT USING (is_public = true OR auth.uid() = author_id);
CREATE POLICY "Authors can manage their own drops" ON public.author_drops FOR ALL USING (auth.uid() = author_id);

-- 6.5 Subscriptions Policies
CREATE POLICY "Subscribers can view their own subscriptions" ON public.author_subscriptions FOR SELECT USING (auth.uid() = subscriber_id);
CREATE POLICY "Authors can view their subscribers" ON public.author_subscriptions FOR SELECT USING (auth.uid() = author_id);

-- 7. Triggers and Functions

-- 7.1 Automatically create author record when profile role is set to author
CREATE OR REPLACE FUNCTION public.handle_author_role_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.role = 'author' AND (OLD.role IS NULL OR OLD.role != 'author')) THEN
        INSERT INTO public.authors (id, display_name)
        VALUES (NEW.id, NEW.full_name)
        ON CONFLICT (id) DO NOTHING;
        
        INSERT INTO public.author_earnings (author_id)
        VALUES (NEW.id)
        ON CONFLICT (author_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_author_role_change
    AFTER UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_author_role_change();

-- 7.2 Update author_earnings when fulfillment_ledger entry is added for author
CREATE OR REPLACE FUNCTION public.sync_author_earnings_from_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_author_id uuid;
BEGIN
    -- Only process author_royalty types
    IF (NEW.metadata->>'type' = 'author_royalty') THEN
        v_author_id := NEW.partner_id;
        
        IF v_author_id IS NOT NULL THEN
            UPDATE public.author_earnings
            SET 
                current_balance = current_balance + NEW.amount,
                total_earned = total_earned + NEW.amount,
                updated_at = now()
            WHERE author_id = v_author_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_ledger_author_royalty
    AFTER INSERT ON public.fulfillment_ledger
    FOR EACH ROW EXECUTE FUNCTION public.sync_author_earnings_from_ledger();

-- 7.3 Handle Payout completion
CREATE OR REPLACE FUNCTION public.handle_payout_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- Transition from pending/processing to completed
    IF (NEW.status = 'completed' AND OLD.status IN ('pending', 'processing')) THEN
        UPDATE public.author_earnings
        SET 
            -- Note: current_balance was already decremented and moved to pending_payouts during request initiation in Edge Function
            pending_payouts = GREATEST(0, pending_payouts - NEW.amount),
            total_withdrawn = total_withdrawn + NEW.amount,
            last_payout_at = NEW.processed_at,
            updated_at = now()
        WHERE author_id = NEW.author_id;
    
    -- Transition to failed (Rollback balance)
    ELSIF (NEW.status = 'failed' AND OLD.status IN ('pending', 'processing')) THEN
        UPDATE public.author_earnings
        SET 
            current_balance = current_balance + NEW.amount,
            pending_payouts = GREATEST(0, pending_payouts - NEW.amount),
            updated_at = now()
        WHERE author_id = NEW.author_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payout_completed
    AFTER UPDATE ON public.author_payouts
    FOR EACH ROW EXECUTE FUNCTION public.handle_payout_completion();

-- 8. Seed existing authors
INSERT INTO public.authors (id, display_name)
SELECT id, full_name FROM public.profiles WHERE role = 'author'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.author_earnings (author_id)
SELECT id FROM public.profiles WHERE role = 'author'
ON CONFLICT (author_id) DO NOTHING;

-- Force schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
