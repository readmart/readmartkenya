-- Migration: Enhance Notification Logs for Resend Integration
-- Description: Adds resend_id and delivery_status columns to notification_logs for better tracking.

BEGIN;

-- 1. Add columns to notification_logs
ALTER TABLE public.notification_logs 
ADD COLUMN IF NOT EXISTS resend_id text,
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS opened_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS clicked_at timestamp with time zone;

-- 2. Create index on resend_id for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_resend_id ON public.notification_logs(resend_id);

-- 3. Add comment to table
COMMENT ON TABLE public.notification_logs IS 'Logs for all outgoing emails sent via Resend with delivery tracking.';

COMMIT;
