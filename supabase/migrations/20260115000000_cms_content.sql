-- 7. CMS Content Migration

-- Create CMS Content
create table public.cms_content (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('banner', 'hero', 'event', 'announcement', 'book_club')),
  title text not null,
  content text,
  image_url text,
  link_url text,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  published_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.cms_content enable row level security;

-- Policies
create policy "CMS content is viewable by everyone" on public.cms_content
  for select using (is_active = true);

create policy "Admins can manage CMS content" on public.cms_content
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));
