-- Phase 7: RBAC Roles Update
-- Add 'author' and 'partner' roles to the profiles role check constraint

-- 1. Drop existing constraint
alter table public.profiles drop constraint profiles_role_check;

-- 2. Add new constraint with expanded roles
alter table public.profiles add constraint profiles_role_check 
  check (role in ('customer', 'admin', 'founder', 'author', 'partner'));

-- 3. Add audit_logs table for Founders
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.audit_logs enable row level security;

-- Policies
create policy "Founders can view all audit logs" on public.audit_logs
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role = 'founder'));

-- 4. Update product policies to allow Authors to manage their own products
-- First, add author_id to products
alter table public.products add column author_id uuid references public.profiles(id);

create policy "Authors can manage their own products" on public.products
  using (auth.uid() = author_id and exists (select 1 from public.profiles where id = auth.uid() and role = 'author'));
