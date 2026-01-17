-- Fix payment_id and payment_metadata columns in orders table
-- Make them nullable as they are filled after order creation

ALTER TABLE public.orders ALTER COLUMN payment_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN payment_metadata DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN payment_metadata SET DEFAULT '{}'::jsonb;
