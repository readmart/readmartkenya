-- ==========================================
-- Migration: Partner Automation
-- Description: Adds automatic record creation for partners when profile role changes, and ensures data integrity.
-- ==========================================

BEGIN;

-- 1. Ensure unique user_id on partners
-- First, clean up any duplicates if they exist (keep the oldest)
DELETE FROM public.partners a USING public.partners b
WHERE a.created_at > b.created_at AND a.user_id = b.user_id;

-- Add unique constraint
ALTER TABLE public.partners DROP CONSTRAINT IF EXISTS partners_user_id_key;
ALTER TABLE public.partners ADD CONSTRAINT partners_user_id_key UNIQUE (user_id);

-- 2. Partner Automation Function
CREATE OR REPLACE FUNCTION public.handle_partner_role_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.role = 'partner' AND (OLD.role IS NULL OR OLD.role != 'partner')) THEN
        INSERT INTO public.partners (user_id, company_name, contact_email, status)
        VALUES (NEW.id, COALESCE(NEW.full_name, 'New Partner'), NEW.email, 'active')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger for Partner
DROP TRIGGER IF EXISTS on_partner_role_change ON public.profiles;
CREATE TRIGGER on_partner_role_change
    AFTER UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_partner_role_change();

-- 4. Sync existing partners
INSERT INTO public.partners (user_id, company_name, contact_email, status)
SELECT id, full_name, email, 'active' 
FROM public.profiles 
WHERE role = 'partner'
ON CONFLICT (user_id) DO NOTHING;

-- 5. Force schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
