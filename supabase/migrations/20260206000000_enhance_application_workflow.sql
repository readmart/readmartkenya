-- Migration: Enhance application workflow for authors and partners
-- Description: Adds contact info, collaboration intent, and proof fields to application tables.
--              Updates status flow and role assignment triggers.

BEGIN;

-- 1. Enhance author_applications table
ALTER TABLE public.author_applications 
ADD COLUMN IF NOT EXISTS contact_info text,
ADD COLUMN IF NOT EXISTS collaboration_intent text,
ADD COLUMN IF NOT EXISTS proof_url text,
ADD COLUMN IF NOT EXISTS agreement_url text,
ADD COLUMN IF NOT EXISTS signed_agreement_url text;

-- Update status constraint for author_applications
-- First, update existing 'approved' to 'completed' if any exist to avoid constraint violation
UPDATE public.author_applications SET status = 'completed' WHERE status = 'approved';

ALTER TABLE public.author_applications 
DROP CONSTRAINT IF EXISTS author_applications_status_check;

ALTER TABLE public.author_applications 
ADD CONSTRAINT author_applications_status_check 
CHECK (status IN ('pending', 'agreement_sent', 'agreement_confirming', 'activating', 'completed', 'rejected'));

-- 2. Enhance partnership_applications table
ALTER TABLE public.partnership_applications 
ADD COLUMN IF NOT EXISTS contact_info text,
ADD COLUMN IF NOT EXISTS collaboration_intent text,
ADD COLUMN IF NOT EXISTS proof_url text,
ADD COLUMN IF NOT EXISTS agreement_url text,
ADD COLUMN IF NOT EXISTS signed_agreement_url text;

-- Update status constraint for partnership_applications
UPDATE public.partnership_applications SET status = 'completed' WHERE status = 'approved';

ALTER TABLE public.partnership_applications 
DROP CONSTRAINT IF EXISTS partnership_applications_status_check;

ALTER TABLE public.partnership_applications 
ADD CONSTRAINT partnership_applications_status_check 
CHECK (status IN ('pending', 'agreement_sent', 'agreement_confirming', 'activating', 'completed', 'rejected'));

-- 3. Update the role assignment trigger function
CREATE OR REPLACE FUNCTION public.handle_application_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if status changed to completed
    IF (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
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

COMMIT;
