-- ======================================================================================
-- MASTER DATABASE RESTORE SCRIPT
-- ======================================================================================
-- Target: All core platform tables, RLS policies, functions, and triggers
-- Use this script if your Supabase schema cache is broken or tables are missing.
-- ======================================================================================

BEGIN;

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CORE TABLES: Profiles & Categories
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email text,
    full_name text,
    avatar_url text,
    role text DEFAULT 'user' CHECK (role IN ('user', 'admin', 'founder', 'partner', 'author')),
    bio text,
    preferences jsonb DEFAULT '{"sms_notifications": false, "newsletter": false}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    description text,
    image_url text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PRODUCTS & INVENTORY
CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text,
    price decimal(12,2) NOT NULL,
    sale_price decimal(12,2),
    stock_quantity integer DEFAULT 0,
    image_url text,
    images text[] DEFAULT '{}',
    is_featured boolean DEFAULT false,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. COMMERCE: Orders, Items, Transactions
CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    base_rate decimal(12,2) NOT NULL DEFAULT 0.00,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
    total_amount decimal(12,2) NOT NULL,
    shipping_address text,
    shipping_zone_id uuid REFERENCES public.shipping_zones(id),
    payment_method text,
    payment_id text,
    payment_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    quantity integer NOT NULL,
    unit_price decimal(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id),
    user_id uuid REFERENCES public.profiles(id),
    amount decimal(12,2) NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.promos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text NOT NULL UNIQUE,
    discount_type text CHECK (discount_type IN ('percentage', 'fixed')) NOT NULL,
    discount_value decimal(12,2) NOT NULL,
    min_order_amount decimal(12,2) DEFAULT 0.00,
    usage_count integer DEFAULT 0,
    usage_limit integer DEFAULT 100,
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL CHECK (type IN ('mpesa', 'card')),
    provider text NOT NULL,
    identifier text NOT NULL,
    is_default boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. CMS & CONTENT
CREATE TABLE IF NOT EXISTS public.banners (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    image_url text,
    link_url text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    published_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    image_url text,
    event_date timestamp with time zone NOT NULL,
    location text,
    type text DEFAULT 'offline' CHECK (type IN ('online', 'offline')),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.book_clubs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    genre text,
    image_url text,
    is_public boolean DEFAULT true,
    require_approval boolean DEFAULT false,
    meeting_frequency text,
    meeting_format text,
    meeting_platform text,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ENGAGEMENT
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    status text check (status in ('New', 'In Progress', 'Resolved', 'pending', 'read', 'replied', 'resolved')) default 'New',
    priority text check (priority in ('Low', 'Medium', 'High')) default 'Medium',
    department text DEFAULT 'General',
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.notification_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient text NOT NULL,
    subject text NOT NULL,
    status text CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
    error_message text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. PARTNERSHIP SYSTEM
CREATE TABLE IF NOT EXISTS public.partnership_tiers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    min_revenue decimal(12,2),
    benefits jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.partners (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    tier_id uuid REFERENCES public.partnership_tiers(id) ON DELETE SET NULL,
    company_name text,
    contact_email text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.partnership_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    email text NOT NULL,
    organization text,
    service_type text,
    description text,
    status text CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
    metadata jsonb DEFAULT '{}'::jsonb,
    signed_agreement_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.author_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name text NOT NULL,
    email text NOT NULL,
    bio text,
    status text CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
    metadata jsonb DEFAULT '{}'::jsonb,
    signed_agreement_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agreements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL CHECK (type IN ('author', 'partner', 'vendor')),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'signed', 'expired')),
    signed_at timestamp with time zone,
    expires_at timestamp with time zone,
    document_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.partnership_services (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    base_cost decimal(12,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fulfillment_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id uuid REFERENCES public.partnership_services(id),
    partner_id uuid REFERENCES public.partners(id),
    amount decimal(12,2) NOT NULL,
    status text DEFAULT 'pending',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. SETTINGS
CREATE TABLE IF NOT EXISTS public.site_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    site_name text DEFAULT 'ReadMart',
    site_logo text,
    contact_email text DEFAULT 'support@readmart.co.ke',
    contact_phone text DEFAULT '+254794129958',
    whatsapp_link text DEFAULT 'https://wa.me/254794129958',
    address text DEFAULT 'Nairobi, Kenya',
    headquarters_address text DEFAULT 'Nairobi, Kenya',
    global_support_whatsapp text DEFAULT 'https://wa.me/254794129958',
    instagram_url text DEFAULT 'https://www.instagram.com/readmartke?igsh=bWdtZDhvcGZsZWNx',
    facebook_url text DEFAULT 'https://www.facebook.com/share/1LB4jKLTTV/',
    x_url text DEFAULT 'https://x.com/readmartke',
    linkedin_url text DEFAULT 'https://linkedin.com/comm/mynetwork/discovery-see-all?usecase=PEOPLE_FOLLOWS&followMember=read-mart-6797423a1',
    hero_headline text DEFAULT 'EVERY PAGE TELLS A STORY',
    hero_subtext text DEFAULT 'Discover a curated sanctuary for bibliophiles and art enthusiasts.',
    hero_image_url text,
    membership_wall_active boolean DEFAULT false,
    membership_price decimal(12,2) DEFAULT 1000.00,
    membership_duration_days integer DEFAULT 30,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 9. POLICIES (Simplified for Restore)
DO $$ 
BEGIN
    -- Profiles
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

    -- Products
    DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
    CREATE POLICY "Products are viewable by everyone" ON public.products FOR SELECT USING (is_active = true);
    
    -- Categories
    DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
    CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (is_active = true);

    -- Orders (Own only)
    DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
    CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);

    -- CMS (Banners, Events, etc)
    DROP POLICY IF EXISTS "CMS viewable by everyone" ON public.banners;
    CREATE POLICY "CMS viewable by everyone" ON public.banners FOR SELECT USING (is_active = true);
    DROP POLICY IF EXISTS "Events viewable by everyone" ON public.events;
    CREATE POLICY "Events viewable by everyone" ON public.events FOR SELECT USING (is_active = true);

    -- Settings
    DROP POLICY IF EXISTS "Settings viewable by everyone" ON public.site_settings;
    CREATE POLICY "Settings viewable by everyone" ON public.site_settings FOR SELECT USING (true);

    -- Admins Manage All
    DECLARE
        v_tables text[] := ARRAY['profiles', 'categories', 'products', 'orders', 'order_items', 'transactions', 'promos', 'payment_methods', 'banners', 'announcements', 'events', 'book_clubs', 'reviews', 'newsletter_subscriptions', 'contact_messages', 'notification_logs', 'partnership_tiers', 'partners', 'partnership_applications', 'author_applications', 'agreements', 'partnership_services', 'fulfillment_ledger', 'site_settings'];
        v_table text;
    BEGIN
        FOREACH v_table IN ARRAY v_tables LOOP
            EXECUTE format('DROP POLICY IF EXISTS "Admins manage all %I" ON public.%I', v_table, v_table);
            EXECUTE format('CREATE POLICY "Admins manage all %I" ON public.%I FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''founder'')))', v_table, v_table);
        END LOOP;
    END;
END $$;

-- 10. TRIGGERS & FUNCTIONS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url', COALESCE(NEW.raw_user_meta_data->>'role', 'user'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 11. SEED DATA
INSERT INTO public.partnership_tiers (name, description, min_revenue, benefits)
VALUES 
    ('Bronze', 'Standard partnership for growing businesses', 10000, '["Listing in partner directory", "Basic analytics"]'),
    ('Silver', 'Advanced partnership with co-marketing', 50000, '["Featured listing", "Priority support", "Monthly reports"]'),
    ('Gold', 'Strategic alliance with exclusive benefits', 200000, '["Home page placement", "Dedicated account manager", "API access"]')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.site_settings (id) 
SELECT gen_random_uuid() WHERE NOT EXISTS (SELECT 1 FROM public.site_settings);

-- 12. NOTIFY POSTGREST
NOTIFY pgrst, 'reload schema';

COMMIT;
