
-- ==========================================
-- Migration: Checkout Tracking & Membership Fixes
-- ==========================================

BEGIN;

-- 1. Create checkout_sessions table for drop-off tracking
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id),
    email text,
    phone text,
    cart_data jsonb,
    status text DEFAULT 'initiated' CHECK (status IN ('initiated', 'shipping_completed', 'payment_initiated', 'completed', 'abandoned')),
    last_step text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS on checkout_sessions
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Policies for checkout_sessions
DROP POLICY IF EXISTS "Users can manage their own checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Users can manage their own checkout sessions" ON public.checkout_sessions
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Founders can view all checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Founders can view all checkout sessions" ON public.checkout_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'founder'
        )
    );

-- 4. Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_checkout_sessions_updated_at
    BEFORE UPDATE ON public.checkout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Ensure membership_payments table exists and is correct
CREATE TABLE IF NOT EXISTS public.membership_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) NOT NULL,
    amount decimal(12,2) NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    payment_id text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.membership_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own membership payments" ON public.membership_payments;
CREATE POLICY "Users can view their own membership payments" ON public.membership_payments
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Founders can view all membership payments" ON public.membership_payments;
CREATE POLICY "Founders can view all membership payments" ON public.membership_payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'founder'
        )
    );

COMMIT;
