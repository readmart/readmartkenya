-- 1. Initial Schema: Profiles, Products, Orders

-- Create Profiles table (Identity Domain)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  avatar_url text,
  role text default 'customer' check (role in ('customer', 'admin', 'founder')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
        CREATE POLICY "Public profiles are viewable by everyone." on public.profiles
          for select using (true);

        DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
        CREATE POLICY "Users can insert their own profile." on public.profiles
          for insert with check (auth.uid() = id);

        DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
        CREATE POLICY "Users can update own profile." on public.profiles
          for update using (auth.uid() = id);
    END IF;
END $$;

-- Create Categories table (Catalog Domain)
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.categories(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Products table (Catalog Domain)
create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text not null unique,
  description text,
  price decimal(12,2) not null,
  sale_price decimal(12,2),
  category_id uuid references public.categories(id),
  metadata jsonb default '{}'::jsonb,
  is_active boolean default true,
  stock_quantity integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Catalog
alter table public.categories enable row level security;
alter table public.products enable row level security;

-- Catalog Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'categories') THEN
        DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
        CREATE POLICY "Categories are viewable by everyone" on public.categories for select using (true);

        DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
        CREATE POLICY "Admins can manage categories" on public.categories
          using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
        CREATE POLICY "Products are viewable by everyone" on public.products for select using (is_active = true);

        DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
        CREATE POLICY "Admins can manage products" on public.products
          using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'founder')));
    END IF;
END $$;

-- Create Orders table (Commerce Domain)
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  total_amount decimal(12,2) not null,
  shipping_address jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Order Items table (Commerce Domain)
create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id),
  quantity integer not null,
  price_at purchase decimal(12,2) not null,
  product_snapshot jsonb not null, -- Snapshot data at purchase
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Commerce
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Commerce Policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
        CREATE POLICY "Users can view their own orders" on public.orders
          for select using (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
        CREATE POLICY "Users can insert their own orders" on public.orders
          for insert with check (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_items') THEN
        DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
        CREATE POLICY "Users can view their own order items" on public.order_items
          for select using (exists (select 1 from public.orders where id = order_id and user_id = auth.uid()));
    END IF;
END $$;

-- Trigger for Profile creation on Auth Signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
