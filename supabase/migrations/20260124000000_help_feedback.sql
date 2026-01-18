-- Create help_feedback table for user suggestions and help page feedback
create table public.help_feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  rating integer check (rating >= 1 and rating <= 5),
  category text not null,
  message text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.help_feedback enable row level security;

-- Policies
create policy "Anyone can submit help feedback" on public.help_feedback
  for insert with check (true);

create policy "Admins can view help feedback" on public.help_feedback
  for select using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));
