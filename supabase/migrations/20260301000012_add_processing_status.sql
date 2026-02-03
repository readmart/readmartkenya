-- ==========================================
-- Migration: Add Processing Status to Payout Ledger
-- Target: fulfillment_ledger
-- Description: Adds 'processing' status to payout_status to track payouts in transit.
-- ==========================================

BEGIN;

-- 1. Update the constraint on payout_status
-- Note: We can't directly alter a check constraint easily in all Postgres versions without dropping and recreating.
ALTER TABLE public.fulfillment_ledger 
DROP CONSTRAINT IF EXISTS fulfillment_ledger_payout_status_check;

ALTER TABLE public.fulfillment_ledger 
ADD CONSTRAINT fulfillment_ledger_payout_status_check 
CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed'));

-- 2. Notify schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
