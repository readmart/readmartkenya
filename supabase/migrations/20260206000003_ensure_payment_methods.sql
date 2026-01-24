
-- ==========================================
-- Migration: Ensure Payment Methods Table
-- Target: payment_methods, profiles
-- ==========================================

BEGIN;

-- 1. Ensure preferences column exists in profiles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'preferences') THEN
        ALTER TABLE public.profiles ADD COLUMN preferences jsonb DEFAULT '{"sms_notifications": false, "newsletter": false}'::jsonb;
    END IF;
END $$;

-- 2. Create payment_methods table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL CHECK (type IN ('mpesa', 'card')),
    provider text NOT NULL,
    identifier text NOT NULL,
    is_default boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- 4. Policies (Drop first to avoid conflicts)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can manage their own payment methods" ON public.payment_methods;
    DROP POLICY IF EXISTS "Admins can view all payment methods" ON public.payment_methods;
END $$;

CREATE POLICY "Users can manage their own payment methods" ON public.payment_methods
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payment methods" ON public.payment_methods
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

COMMIT;
