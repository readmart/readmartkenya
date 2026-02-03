
-- ==========================================
-- Migration: Add KopoKopo Recipient ID to Profiles
-- Description: Caches the K2 Pay Recipient ID to avoid redundant API calls.
-- ==========================================

BEGIN;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS k2_recipient_id text;

COMMIT;
