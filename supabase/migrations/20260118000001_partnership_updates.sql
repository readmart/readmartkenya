-- Partnership Agreements Table
create table public.partnership_agreements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  type text check (type in ('author', 'service_provider')) not null,
  is_active boolean default true,
  version text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Update Partnership Applications to link to user and agreement
alter table public.partnership_applications 
  add column user_id uuid references auth.users(id),
  add column agreement_id uuid references public.partnership_agreements(id),
  add column type text check (type in ('author', 'service_provider'));

-- Enable RLS for partnership_agreements
alter table public.partnership_agreements enable row level security;

-- Policies for partnership_agreements
create policy "Anyone can view active agreements" on public.partnership_agreements
  for select using (is_active = true);

create policy "Admins can manage agreements" on public.partnership_agreements
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));

-- Update policies for partnership_applications
drop policy if exists "Anyone can submit a partnership application" on public.partnership_applications;
drop policy if exists "Admins can view partnership applications" on public.partnership_applications;

create policy "Users can view their own applications" on public.partnership_applications
  for select using (auth.uid() = user_id);

create policy "Users can insert their own applications" on public.partnership_applications
  for insert with check (auth.uid() = user_id);

create policy "Admins can manage all applications" on public.partnership_applications
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));
