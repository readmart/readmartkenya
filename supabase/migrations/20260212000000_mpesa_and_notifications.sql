-- ==========================================
-- Migration: M-Pesa Integration, Notifications & Helper Functions
-- Target: orders, notifications, site_settings
-- Description: Adds fields for M-Pesa flow, creates notifications table, and implements global sync & membership helpers.
-- ==========================================

BEGIN;

-- 1. Create Notifications Table (Missing from migrations, present in seed.sql)
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL, -- 'order', 'promo', 'system', 'membership', etc.
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1.1 Notifications RLS Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users view own notifications') THEN
        CREATE POLICY "Users view own notifications" ON public.notifications
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users update own notifications') THEN
        CREATE POLICY "Users update own notifications" ON public.notifications
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Admins manage all notifications') THEN
        CREATE POLICY "Admins manage all notifications" ON public.notifications
            FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder')));
    END IF;
END $$;

-- 2. Enhance Orders for M-Pesa & Payment Flow
DO $$ 
BEGIN
    -- Update status check constraint to include 'paid' and 'shipping'
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
        CHECK (status IN ('pending', 'paid', 'processing', 'shipping', 'completed', 'cancelled'));

    -- Add is_paid flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'is_paid') THEN
        ALTER TABLE public.orders ADD COLUMN is_paid boolean DEFAULT false;
    END IF;

    -- Add payment_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_status') THEN
        ALTER TABLE public.orders ADD COLUMN payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed', 'refunded'));
    END IF;

    -- Add mpesa_receipt_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'mpesa_receipt_number') THEN
        ALTER TABLE public.orders ADD COLUMN mpesa_receipt_number text;
    END IF;
END $$;

-- 3. Enhance Site Settings for Global Sync & Tracking
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS total_revenue_cache decimal(15,2) DEFAULT 0.00;

-- 4. Helper Function: Check Membership Status
CREATE OR REPLACE FUNCTION public.check_membership_status(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
    v_is_member boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.membership_payments
        WHERE user_id = p_user_id
        AND status = 'completed'
        AND expires_at > now()
    ) INTO v_is_member;
    
    RETURN v_is_member;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper Function: Mark Order as Paid (Handles M-Pesa confirmation logic)
CREATE OR REPLACE FUNCTION public.mark_order_as_paid(p_order_id uuid, p_receipt text)
RETURNS jsonb AS $$
DECLARE
    v_order_record RECORD;
    v_is_digital_only boolean;
    v_new_status text;
BEGIN
    -- 1. Get order
    SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Order not found');
    END IF;

    -- 2. Check if this is a digital-only order (all items are ebooks)
    SELECT NOT EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.products p ON oi.product_id = p.id
        WHERE oi.order_id = p_order_id
        AND p.type != 'ebook'
    ) INTO v_is_digital_only;

    -- 3. Determine new status
    IF v_is_digital_only THEN
        v_new_status := 'completed';
    ELSE
        v_new_status := 'processing';
    END IF;

    -- 4. Update order
    UPDATE public.orders
    SET 
        is_paid = true,
        payment_status = 'paid',
        mpesa_receipt_number = p_receipt,
        status = v_new_status,
        updated_at = now()
    WHERE id = p_order_id;

    -- 5. Create notification for user
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
        v_order_record.user_id,
        'order',
        'Payment Confirmed',
        CASE 
            WHEN v_is_digital_only THEN 'Your payment for order #' || p_order_id || ' has been confirmed. Your e-books are now available in your library.'
            ELSE 'Your payment for order #' || p_order_id || ' has been confirmed. We are now processing your order.'
        END
    );

    -- 6. Log transaction
    INSERT INTO public.transactions (order_id, user_id, amount, status)
    VALUES (p_order_id, v_order_record.user_id, v_order_record.total_amount, 'completed');

    -- 7. Trigger global sync to update revenue cache
    PERFORM public.execute_global_sync();

    RETURN jsonb_build_object(
        'status', 'success', 
        'message', 'Order marked as paid',
        'is_digital_only', v_is_digital_only,
        'new_status', v_new_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Improved Global Sync Function (Updates caches)
CREATE OR REPLACE FUNCTION public.execute_global_sync()
RETURNS jsonb AS $$
DECLARE
    v_revenue decimal;
BEGIN
    -- 1. Calculate total revenue
    SELECT COALESCE(SUM(total_amount), 0) INTO v_revenue 
    FROM public.orders 
    WHERE is_paid = true;

    -- 2. Update site_settings cache
    UPDATE public.site_settings
    SET 
        total_revenue_cache = v_revenue,
        last_sync_at = now()
    WHERE id = 'global';

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'Global synchronization complete. Revenue cache updated.',
        'revenue', v_revenue,
        'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
