-- 2. Partnership System Migration

-- Create Partnership Services
create table public.partnership_services (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  commission_rate decimal(5,2), -- for commission based
  fixed_fee decimal(12,2), -- for fixed fee based
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Payout Ledger
create table public.fulfillment_ledger (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) not null,
  partner_service_id uuid references public.partnership_services(id),
  amount decimal(12,2) not null,
  payout_status text default 'pending' check (payout_status in ('pending', 'paid', 'failed')),
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.partnership_services enable row level security;
alter table public.fulfillment_ledger enable row level security;

-- Policies
create policy "Partnership services are viewable by admins" on public.partnership_services
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));

create policy "Ledger is viewable by admins" on public.fulfillment_ledger
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));
