-- ==========================================
-- Migration: Add webhook_event_id to transactions
-- Description: Supports idempotent K2 webhook handling and allows
--              membership-only transactions by making order_id nullable.
-- ==========================================

BEGIN;

-- Add webhook_event_id column if it does not exist
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS webhook_event_id text;

-- Ensure order_id can be null for non-order transactions (e.g. memberships)
ALTER TABLE public.transactions
ALTER COLUMN order_id DROP NOT NULL;

-- Unique index on webhook_event_id for idempotency (only when present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_class c
    JOIN   pg_namespace n ON n.oid = c.relnamespace
    WHERE  c.relname = 'transactions_webhook_event_id_key'
    AND    n.nspname = 'public'
  ) THEN
    CREATE UNIQUE INDEX transactions_webhook_event_id_key
      ON public.transactions (webhook_event_id)
      WHERE webhook_event_id IS NOT NULL;
  END IF;
END
$$;

COMMIT;

