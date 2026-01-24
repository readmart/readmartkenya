
-- ==========================================
-- Migration: Fix Checkout Sessions Visibility
-- Target: checkout_sessions
-- Description: Ensures the table exists, has correct columns, and is visible to the API.
-- ==========================================

BEGIN;

-- 1. Create checkout_sessions if missing (redundant but safe)
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

-- 2. Add shipping_zone_id if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'checkout_sessions' AND column_name = 'shipping_zone_id') THEN
        ALTER TABLE public.checkout_sessions ADD COLUMN shipping_zone_id uuid REFERENCES public.shipping_zones(id);
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Standardize Policies
DROP POLICY IF EXISTS "Users can manage their own checkout sessions" ON public.checkout_sessions;
DROP POLICY IF EXISTS "Anyone can create a checkout session" ON public.checkout_sessions;
DROP POLICY IF EXISTS "Founders can view all checkout sessions" ON public.checkout_sessions;

-- Allow authenticated users to manage their own sessions
CREATE POLICY "Users can manage their own checkout sessions" ON public.checkout_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Allow anonymous users to insert sessions (for guest checkout tracking)
-- Note: They won't be able to select it back unless we have a session secret, 
-- but this prevents the POST 404/403 for guest flows.
CREATE POLICY "Anyone can create a checkout session" ON public.checkout_sessions
    FOR INSERT WITH CHECK (true);

-- Allow founders to view all
CREATE POLICY "Founders can view all checkout sessions" ON public.checkout_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'founder'
        )
    );

-- 5. Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_checkout_sessions_updated_at ON public.checkout_sessions;
CREATE TRIGGER set_checkout_sessions_updated_at
    BEFORE UPDATE ON public.checkout_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Grant access to roles
GRANT ALL ON public.checkout_sessions TO authenticated;
GRANT ALL ON public.checkout_sessions TO anon;
GRANT ALL ON public.checkout_sessions TO service_role;

COMMIT;
