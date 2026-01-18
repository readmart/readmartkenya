-- Author Applications Table Updates
do $$ 
begin
  if not exists (select from pg_tables where schemaname = 'public' and tablename = 'author_applications') then
    create table public.author_applications (
      id uuid default gen_random_uuid() primary key,
      full_name text not null,
      email text not null,
      bio text,
      status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
      metadata jsonb default '{}'::jsonb,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null
    );
  end if;
end $$;

-- Update Author Applications to link to user and agreement
alter table public.author_applications 
  add column if not exists user_id uuid references auth.users(id),
  add column if not exists agreement_id uuid references public.partnership_agreements(id);

-- Enable RLS for author_applications
alter table public.author_applications enable row level security;

-- Policies for author_applications
drop policy if exists "Anyone can submit an author application" on public.author_applications;
drop policy if exists "Admins can view author applications" on public.author_applications;

create policy "Users can view their own author applications" on public.author_applications
  for select using (auth.uid() = user_id);

create policy "Users can insert their own author applications" on public.author_applications
  for insert with check (auth.uid() = user_id);

create policy "Admins can manage all author applications" on public.author_applications
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));
