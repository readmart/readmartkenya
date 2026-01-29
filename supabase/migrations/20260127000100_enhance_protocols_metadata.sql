-- Migration: Add metadata to partnership_agreements
-- Description: Adds a jsonb metadata column to store key terms and other configuration for protocol templates.

BEGIN;

ALTER TABLE public.partnership_agreements 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{"key_terms": []}'::jsonb;

-- Update existing records to have the default metadata
UPDATE public.partnership_agreements 
SET metadata = '{"key_terms": []}'::jsonb 
WHERE metadata IS NULL;

COMMIT;
