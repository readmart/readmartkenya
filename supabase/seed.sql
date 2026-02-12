-- ==========================================
-- READMART SEED DATA & SCHEMA INITIALIZATION
-- ==========================================

-- 1. Base Tables
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text,
    price decimal(12,2) NOT NULL,
    category_id uuid REFERENCES public.categories(id),
    stock_quantity integer DEFAULT 0,
    image_url text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. User & Admin Tables
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY, -- Linked to auth.users.id
    email text,
    full_name text,
    avatar_url text,
    role text DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'founder', 'author', 'partner')),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Core Transactions
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled')),
    total_amount decimal(12,2) NOT NULL,
    shipping_address jsonb,
    payment_method text,
    payment_status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id uuid REFERENCES public.products(id),
    quantity integer NOT NULL,
    price_at_purchase decimal(12,2) NOT NULL,
    product_snapshot jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Feedback & Auditing
CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    rating integer CHECK (rating >= 1 AND rating <= 5),
    comment text,
    is_approved boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    performed_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. System Configuration
CREATE TABLE IF NOT EXISTS public.settings (
    id text PRIMARY KEY DEFAULT 'global',
    site_name text DEFAULT 'READMART',
    contact_email text,
    currency text DEFAULT 'KES',
    tax_rate decimal(5,2) DEFAULT 0.00,
    maintenance_mode boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Platform Specifics
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id),
    amount decimal(12,2) NOT NULL,
    type text NOT NULL, -- 'payment', 'refund', 'payout'
    provider text DEFAULT 'mpesa',
    provider_ref text,
    status text DEFAULT 'pending',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.author_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name text NOT NULL,
    email text NOT NULL,
    bio text,
    portfolio_url text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notification_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL, -- 'email', 'push', 'sms'
    recipient text NOT NULL,
    subject text,
    status text DEFAULT 'sent',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.partnership_services (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    base_price decimal(12,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fulfillment_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id),
    action text NOT NULL,
    status text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Missing & Extended Tables
CREATE TABLE IF NOT EXISTS public.shipping_zones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    rate decimal(12,2) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.promos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text NOT NULL UNIQUE,
    discount_type text CHECK (discount_type IN ('percentage', 'fixed')) NOT NULL,
    discount_value decimal(12,2) NOT NULL,
    min_order_amount decimal(12,2) DEFAULT 0.00,
    is_active boolean DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Split CMS Tables
CREATE TABLE IF NOT EXISTS public.banners (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    image_url text,
    link_url text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.book_clubs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    image_url text,
    founder_id uuid,
    membership_price decimal(12,2) DEFAULT 0.00,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    image_url text,
    link_url text,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL,
    subject text,
    message text NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'replied')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.partnership_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_name text NOT NULL,
    contact_person text NOT NULL,
    email text NOT NULL,
    phone text,
    service_type text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    event_date timestamp with time zone NOT NULL,
    location text,
    image_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ebook_metadata (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL UNIQUE,
    file_path text NOT NULL,
    format text DEFAULT 'pdf',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wishlist_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.book_club_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.book_clubs(id) ON DELETE CASCADE NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'invited', 'banned')),
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(club_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    type text NOT NULL, -- 'order', 'promo', 'system', etc.
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Enable RLS (Safety)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebook_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 9. Seed Data
-- Categories
INSERT INTO public.categories (name, slug) VALUES 
('Fiction', 'fiction'),
('Non-Fiction', 'non-fiction'),
('Technology', 'technology'),
('Art & Design', 'art-design'),
('Business', 'business')
ON CONFLICT (slug) DO NOTHING;

-- Products
WITH cat AS (SELECT id, slug FROM public.categories)
INSERT INTO public.products (title, slug, description, price, category_id, stock_quantity, metadata) VALUES 
('The Alchemist', 'the-alchemist', 'A classic tale of following your dreams.', 1200.00, (SELECT id FROM cat WHERE slug = 'fiction'), 50, '{"type": "physical", "author": "Paulo Coelho"}'),
('Clean Code', 'clean-code', 'A handbook of agile software craftsmanship.', 3500.00, (SELECT id FROM cat WHERE slug = 'technology'), 20, '{"type": "physical", "author": "Robert C. Martin"}'),
('Zero to One', 'zero-to-one', 'Notes on startups, or how to build the future.', 1800.00, (SELECT id FROM cat WHERE slug = 'business'), 30, '{"type": "physical", "author": "Peter Thiel"}'),
('Thinking, Fast and Slow', 'thinking-fast-slow', 'Exploration of the mind and decision making.', 2200.00, (SELECT id FROM cat WHERE slug = 'non-fiction'), 15, '{"type": "physical", "author": "Daniel Kahneman"}'),
('Design for Hackers', 'design-for-hackers', 'Reverse-engineering beauty for software developers.', 2800.00, (SELECT id FROM cat WHERE slug = 'art-design'), 10, '{"type": "physical", "author": "David Kadavy"}')
ON CONFLICT (slug) DO NOTHING;

-- Shipping Zones
INSERT INTO public.shipping_zones (name, rate) VALUES 
('Nairobi', 250.00),
('Mombasa', 450.00),
('Kisumu', 400.00),
('Nakuru', 300.00),
('Other Regions', 600.00)
ON CONFLICT (name) DO NOTHING;

-- Banners
INSERT INTO public.banners (title, content, image_url, metadata) VALUES 
('EVERY PAGE TELLS A STORY', 'Discover a curated sanctuary for bibliophiles and art enthusiasts. Bridging the gap between creators and readers.', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f', '{"button_text": "Shop Now"}')
ON CONFLICT DO NOTHING;

-- Book Clubs
INSERT INTO public.book_clubs (name, description, image_url, metadata) VALUES 
('The Classics Club', 'Exploring timeless literature from around the world.', 'https://images.unsplash.com/photo-1512820790803-83ca734da794', '{"tier": "basic"}'),
('Tech Visionaries', 'Discussing the future of technology and society.', 'https://images.unsplash.com/photo-1518770660439-4636190af475', '{"tier": "premium"}')
ON CONFLICT DO NOTHING;

-- Settings
INSERT INTO public.settings (id, site_name, tax_rate, currency)
VALUES ('global', 'READMART', 16.00, 'KES')
ON CONFLICT (id) DO NOTHING;

-- Analytics Data: Sample Orders
DO $$
DECLARE
    dummy_user_id uuid := '00000000-0000-0000-0000-000000000000';
    order1_id uuid;
    order2_id uuid;
    prod1_id uuid;
    prod2_id uuid;
BEGIN
    -- Get some product IDs
    SELECT id INTO prod1_id FROM public.products WHERE slug = 'the-alchemist';
    SELECT id INTO prod2_id FROM public.products WHERE slug = 'clean-code';

    -- Create Sample Order 1 (Completed)
    INSERT INTO public.orders (user_id, status, total_amount, created_at)
    VALUES (dummy_user_id, 'completed', 4700.00, now() - interval '2 days')
    RETURNING id INTO order1_id;

    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase, product_snapshot)
    VALUES 
    (order1_id, prod1_id, 1, 1200.00, '{"title": "The Alchemist", "price": 1200.00}'),
    (order1_id, prod2_id, 1, 3500.00, '{"title": "Clean Code", "price": 3500.00}');

    -- Create Sample Order 2 (Completed)
    INSERT INTO public.orders (user_id, status, total_amount, created_at)
    VALUES (dummy_user_id, 'completed', 1800.00, now() - interval '1 day')
    RETURNING id INTO order2_id;

    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase, product_snapshot)
    VALUES (order2_id, (SELECT id FROM public.products WHERE slug = 'zero-to-one'), 1, 1800.00, '{"title": "Zero to One", "price": 1800.00}');

    -- Create Sample Reviews
    INSERT INTO public.reviews (user_id, product_id, rating, comment, created_at)
    VALUES 
    (dummy_user_id, prod1_id, 5, 'An inspiring read!', now() - interval '3 days'),
    (dummy_user_id, prod2_id, 4, 'Very technical but worth it.', now() - interval '1 day');

    -- Create Audit Logs
    INSERT INTO public.audit_logs (action, entity_type, created_at)
    VALUES 
    ('DATABASE_INITIALIZED', 'SYSTEM', now()),
    ('SEED_DATA_APPLIED', 'SYSTEM', now());

END $$;

COMMIT;
