-- ==========================================
-- Migration: Membership System & Payment Wall
-- ==========================================

BEGIN;

-- 1. Update settings table with membership configurations
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS membership_wall_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS membership_price decimal(12,2) DEFAULT 1000.00,
ADD COLUMN IF NOT EXISTS membership_duration_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS membership_title text DEFAULT 'ReadMart Premium Member',
ADD COLUMN IF NOT EXISTS membership_description text DEFAULT 'Get exclusive access to book clubs, insights, and early bird events.';

-- 2. Update profiles table to track membership status
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_member boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS membership_expires_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS membership_started_at timestamp with time zone;

-- 3. Create membership_payments table to track subscription history
CREATE TABLE IF NOT EXISTS public.membership_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount decimal(12,2) NOT NULL,
    currency text DEFAULT 'KES',
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    payment_id text, -- Provider reference
    metadata jsonb DEFAULT '{}'::jsonb,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.membership_payments ENABLE ROW LEVEL SECURITY;

-- 5. Policies for membership_payments
CREATE POLICY "Users can view their own membership payments" ON public.membership_payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Founders and admins can view all membership payments" ON public.membership_payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

COMMIT;
