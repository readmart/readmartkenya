-- ==========================================
-- Migration: Preferences and Payment Methods
-- ==========================================

BEGIN;

-- 1. Add preferences column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{"sms_notifications": false, "newsletter": false}'::jsonb;

-- 2. Create payment_methods table
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL CHECK (type IN ('mpesa', 'card')),
    provider text NOT NULL, -- e.g., 'Safaricom'
    identifier text NOT NULL, -- phone number or masked card number
    is_default boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- 4. Policies
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
