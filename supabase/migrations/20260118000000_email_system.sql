-- Phase 8: Email Infrastructure & Messaging
-- Create notification_logs for email auditability
create table public.notification_logs (
  id uuid default gen_random_uuid() primary key,
  recipient text not null,
  subject text not null,
  status text check (status in ('pending', 'sent', 'failed')) default 'pending',
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create contact_messages for public inquiries
create table public.contact_messages (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text check (status in ('New', 'In Progress', 'Resolved')) default 'New',
  priority text check (priority in ('Low', 'Medium', 'High')) default 'Medium',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.notification_logs enable row level security;
alter table public.contact_messages enable row level security;

-- Policies for notification_logs
create policy "Admins can view all notification logs" on public.notification_logs
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));

-- Policies for contact_messages
create policy "Public can insert contact messages" on public.contact_messages
  for insert with check (true);

create policy "Admins can manage contact messages" on public.contact_messages
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));

-- Author Applications Table
create table public.author_applications (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null,
  bio text,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Partnership Applications Table
create table public.partnership_applications (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null,
  organization text,
  service_type text,
  description text,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.author_applications enable row level security;
alter table public.partnership_applications enable row level security;

-- Policies
create policy "Anyone can submit an author application" on public.author_applications
  for insert with check (true);

create policy "Admins can view author applications" on public.author_applications
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));

create policy "Anyone can submit a partnership application" on public.partnership_applications
  for insert with check (true);

create policy "Admins can view partnership applications" on public.partnership_applications
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));
