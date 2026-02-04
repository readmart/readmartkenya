-- ==========================================
-- Migration: Partnership Workflow Alignment
-- Target: partnership_agreements, agreements, applications
-- Description: Unifies types and ensures consistent linking between templates and instances.
-- ==========================================

BEGIN;

-- 1. Align types in partnership_agreements
ALTER TABLE public.partnership_agreements DROP CONSTRAINT IF EXISTS partnership_agreements_type_check;
ALTER TABLE public.partnership_agreements ADD CONSTRAINT partnership_agreements_type_check 
    CHECK (type IN ('author', 'partner', 'service_provider', 'general'));

-- 2. Update Application status constraints to include workflow steps
ALTER TABLE public.author_applications DROP CONSTRAINT IF EXISTS author_applications_status_check;
ALTER TABLE public.author_applications ADD CONSTRAINT author_applications_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'agreement_sent', 'completed'));

ALTER TABLE public.partnership_applications DROP CONSTRAINT IF EXISTS partnership_applications_status_check;
ALTER TABLE public.partnership_applications ADD CONSTRAINT partnership_applications_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'agreement_sent', 'completed'));

-- 3. Ensure agreements table has a unique constraint for upserts
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agreements') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'agreements_partner_id_type_key'
        ) THEN
            ALTER TABLE public.agreements 
            ADD CONSTRAINT agreements_partner_id_type_key UNIQUE (partner_id, type);
        END IF;
    END IF;
END $$;

-- 4. Add protocol_id to agreements table if it doesn't exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agreements') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agreements' AND column_name = 'protocol_id') THEN
            ALTER TABLE public.agreements ADD COLUMN protocol_id uuid REFERENCES public.partnership_agreements(id);
        END IF;
    END IF;
END $$;

-- 5. Trigger Function to sync agreement status back to applications
CREATE OR REPLACE FUNCTION public.sync_agreement_to_application()
RETURNS TRIGGER AS $$
DECLARE
    v_table text;
BEGIN
    -- When an agreement is signed
    IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
        v_table := CASE 
            WHEN NEW.type = 'author' THEN 'author_applications'
            WHEN NEW.type = 'partner' THEN 'partnership_applications'
            ELSE NULL
        END;

        IF v_table IS NOT NULL THEN
            -- Update the application status to completed
            EXECUTE format('UPDATE public.%I SET status = ''completed'', metadata = jsonb_set(COALESCE(metadata, ''{}''::jsonb), ''{signed_at}'', %L) WHERE user_id = $1', v_table, quote_literal(now()))
            USING NEW.partner_id;

            -- Update the user's role in profiles
            UPDATE public.profiles 
            SET role = CASE WHEN NEW.type = 'author' THEN 'author' ELSE 'partner' END
            WHERE id = NEW.partner_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Apply the trigger
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agreements') THEN
        DROP TRIGGER IF EXISTS tr_sync_agreement_status ON public.agreements;
        CREATE TRIGGER tr_sync_agreement_status
            AFTER UPDATE OF status ON public.agreements
            FOR EACH ROW
            EXECUTE PROCEDURE public.sync_agreement_to_application();
    END IF;
END $$;

-- 7. Disable premature role update in applications approval trigger
-- (We now wait for the agreement to be signed)
DROP TRIGGER IF EXISTS tr_author_approval ON public.author_applications;
DROP TRIGGER IF EXISTS tr_partner_approval ON public.partnership_applications;

COMMIT;
