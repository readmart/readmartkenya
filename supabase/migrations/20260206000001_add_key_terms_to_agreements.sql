-- Migration: Add key terms to agreements table
-- Description: Adds a jsonb column for highlighting key terms in agreements.

BEGIN;

ALTER TABLE public.agreements 
ADD COLUMN IF NOT EXISTS key_terms jsonb DEFAULT '[]'::jsonb;

COMMIT;
