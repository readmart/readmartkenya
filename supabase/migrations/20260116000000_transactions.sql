-- 8. Transactions & Payments System

create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) not null,
  user_id uuid references public.profiles(id) not null,
  amount decimal(12,2) not null,
  currency text default 'KES',
  provider text default 'kopokopo',
  provider_reference text, -- K2 reference
  status text default 'pending' check (status in ('pending', 'completed', 'failed')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.transactions enable row level security;

-- Policies
create policy "Users can view their own transactions" on public.transactions
  for select using (auth.uid() = user_id);

create policy "Admins can view all transactions" on public.transactions
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));
