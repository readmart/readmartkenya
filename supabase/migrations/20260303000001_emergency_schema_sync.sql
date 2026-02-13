-- ==========================================
-- EMERGENCY SCHEMA SYNC (March 2026)
-- Resolves:
-- 1. Missing columns in fulfillment_ledger (order_id, partner_id)
-- 2. Missing table book_club_members
-- 3. Missing columns in products for analytics
-- ==========================================

BEGIN;

-- 1. Ensure fulfillment_ledger exists and has all required columns
CREATE TABLE IF NOT EXISTS public.fulfillment_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    amount decimal(12,2) NOT NULL,
    payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'failed')),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add missing columns to fulfillment_ledger
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger' AND column_name = 'order_id') THEN
        ALTER TABLE public.fulfillment_ledger ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger' AND column_name = 'partner_id') THEN
        ALTER TABLE public.fulfillment_ledger ADD COLUMN partner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger' AND column_name = 'partner_service_id') THEN
        ALTER TABLE public.fulfillment_ledger ADD COLUMN partner_service_id uuid; -- References partnership_services if it exists
    END IF;
END $$;

-- 2. Ensure book_club_members exists
CREATE TABLE IF NOT EXISTS public.book_club_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'invited', 'banned')),
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(club_id, user_id)
);

-- 3. Ensure products has columns for analytics
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'author_id') THEN
        ALTER TABLE public.products ADD COLUMN author_id uuid REFERENCES public.profiles(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock_quantity') THEN
        ALTER TABLE public.products ADD COLUMN stock_quantity integer DEFAULT 0;
    END IF;
END $$;

-- 4. Fix RLS for fulfillment_ledger to allow partners/authors to see their own data
ALTER TABLE public.fulfillment_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ledger entries" ON public.fulfillment_ledger;
CREATE POLICY "Users can view their own ledger entries" ON public.fulfillment_ledger
    FOR SELECT USING (
        auth.uid() = partner_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
    );

-- 5. Fix RLS for book_club_members
ALTER TABLE public.book_club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view club memberships" ON public.book_club_members;
CREATE POLICY "Members can view club memberships" ON public.book_club_members
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join clubs" ON public.book_club_members;
CREATE POLICY "Users can join clubs" ON public.book_club_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
