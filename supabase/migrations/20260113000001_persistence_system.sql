-- 3 & 4. Persistence Migration: Cart and Wishlist

-- Create Cart Items
create table public.cart_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  quantity integer default 1 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, product_id)
);

-- Create Wishlist Items
create table public.wishlist_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, product_id)
);

-- Enable RLS
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;

-- Policies
create policy "Users can manage their own cart" on public.cart_items
  using (auth.uid() = user_id);

create policy "Users can manage their own wishlist" on public.wishlist_items
  using (auth.uid() = user_id);
