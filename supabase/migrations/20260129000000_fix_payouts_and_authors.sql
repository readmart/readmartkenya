-- ==========================================
-- Migration: Fix Payouts, Authors and Application Workflow
-- Target: fulfillment_ledger, profiles, applications
-- ==========================================

BEGIN;

-- 1. Enhance fulfillment_ledger with partner_id
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger' AND column_name = 'partner_id') THEN
        ALTER TABLE public.fulfillment_ledger ADD COLUMN partner_id uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- 2. Add Author Commission Rate to site_settings if missing
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS author_commission_rate decimal(5,2) DEFAULT 70.00;

-- 3. Trigger for Auto-Updating User Roles on Application Approval
CREATE OR REPLACE FUNCTION public.handle_application_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if status changed to approved
    IF (NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved')) THEN
        -- Check if it's an author application
        IF (TG_TABLE_NAME = 'author_applications') THEN
            UPDATE public.profiles 
            SET role = 'author' 
            WHERE id = NEW.user_id;
        -- Check if it's a partnership application
        ELSIF (TG_TABLE_NAME = 'partnership_applications') THEN
            UPDATE public.profiles 
            SET role = 'partner' 
            WHERE id = NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers to both tables
DROP TRIGGER IF EXISTS tr_author_approval ON public.author_applications;
CREATE TRIGGER tr_author_approval
    AFTER UPDATE OF status ON public.author_applications
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_application_approval();

DROP TRIGGER IF EXISTS tr_partner_approval ON public.partnership_applications;
CREATE TRIGGER tr_partner_approval
    AFTER UPDATE OF status ON public.partnership_applications
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_application_approval();

-- 4. Fix RLS for fulfillment_ledger to allow partners to view their own payouts
DROP POLICY IF EXISTS "Partners can view their own payouts" ON public.fulfillment_ledger;
CREATE POLICY "Partners can view their own payouts" ON public.fulfillment_ledger
    FOR SELECT USING (
        auth.uid() = partner_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
    );

COMMIT;
