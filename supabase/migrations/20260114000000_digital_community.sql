-- 5 & 6. Digital & Community Migration: Book Club and E-Books

-- Create Book Club Membership
create table public.book_club_memberships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  club_id uuid references public.cms_content(id) on delete cascade,
  tier text default 'basic' check (tier in ('basic', 'premium', 'vip')),
  expires_at timestamp with time zone,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, club_id)
);

-- Create E-Books Metadata
create table public.ebook_metadata (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  file_path text not null, -- Path in private 'ebooks' bucket
  format text check (format in ('pdf', 'epub', 'mobi')),
  device_limit integer default 3,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.book_club_memberships enable row level security;
alter table public.ebook_metadata enable row level security;

-- Policies
create policy "Users can view their own membership" on public.book_club_memberships
  using (auth.uid() = user_id);

create policy "E-book metadata is viewable by admins or owners" on public.ebook_metadata
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder'))
    or
    exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.user_id = auth.uid() and oi.product_id = ebook_metadata.product_id
    )
  );
