-- Add payment tracking to orders
alter table public.orders add column if not null payment_id text;
alter table public.orders add column if not null payment_metadata jsonb default '{}'::jsonb;

-- Update status constraint to include paid and failed
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check 
  check (status in ('pending', 'paid', 'processing', 'completed', 'cancelled', 'failed'));
