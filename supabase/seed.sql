-- ==========================================
-- READMART: Database Initialization & Seed
-- Purpose: Ensures all core analytics tables exist and populates them with sample data
-- ==========================================

BEGIN;

-- 1. Ensure Categories exist
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    slug text NOT NULL UNIQUE,
    parent_id uuid REFERENCES public.categories(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ensure Products exist
CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text,
    price decimal(12,2) NOT NULL,
    sale_price decimal(12,2),
    category_id uuid REFERENCES public.categories(id),
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    stock_quantity integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    author_id uuid
);

-- 3. Ensure Orders exist
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    total_amount decimal(12,2) NOT NULL,
    shipping_address jsonb,
    payment_id text,
    payment_metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Ensure Order Items exist
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id uuid REFERENCES public.products(id),
    quantity integer NOT NULL,
    price_at_purchase decimal(12,2) NOT NULL,
    product_snapshot jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Ensure Reviews exist
CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Ensure Audit Logs exist
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Ensure Settings exist
CREATE TABLE IF NOT EXISTS public.settings (
    id text PRIMARY KEY DEFAULT 'global',
    site_name text DEFAULT 'READMART',
    site_logo text,
    contact_email text,
    contact_phone text,
    address text,
    whatsapp_link text,
    tax_rate decimal(5,2) DEFAULT 16.00,
    default_currency text DEFAULT 'KES',
    maintenance_mode boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7.1 Ensure Transactions exist
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) NOT NULL,
    user_id uuid NOT NULL,
    amount decimal(12,2) NOT NULL,
    currency text DEFAULT 'KES',
    provider text DEFAULT 'kopokopo',
    provider_reference text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7.2 Ensure Missing Analytics/Admin Tables exist
CREATE TABLE IF NOT EXISTS public.author_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name text NOT NULL,
    email text NOT NULL,
    bio text,
    status text CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
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

CREATE TABLE IF NOT EXISTS public.partnership_services (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fulfillment_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) NOT NULL,
    partner_service_id uuid REFERENCES public.partnership_services(id),
    amount decimal(12,2) NOT NULL,
    payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'failed')),
    metadata jsonb,
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

-- 9. Seed Data
-- Clear existing to avoid conflicts (Optional, comment out if you want to keep existing data)
-- DELETE FROM public.order_items;
-- DELETE FROM public.orders;
-- DELETE FROM public.reviews;
-- DELETE FROM public.products;
-- DELETE FROM public.categories;

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
INSERT INTO public.products (name, slug, description, price, category_id, stock_quantity) VALUES 
('The Alchemist', 'the-alchemist', 'A classic tale of following your dreams.', 1200.00, (SELECT id FROM cat WHERE slug = 'fiction'), 50),
('Clean Code', 'clean-code', 'A handbook of agile software craftsmanship.', 3500.00, (SELECT id FROM cat WHERE slug = 'technology'), 20),
('Zero to One', 'zero-to-one', 'Notes on startups, or how to build the future.', 1800.00, (SELECT id FROM cat WHERE slug = 'business'), 30),
('Thinking, Fast and Slow', 'thinking-fast-slow', 'Exploration of the mind and decision making.', 2200.00, (SELECT id FROM cat WHERE slug = 'non-fiction'), 15),
('Design for Hackers', 'design-for-hackers', 'Reverse-engineering beauty for software developers.', 2800.00, (SELECT id FROM cat WHERE slug = 'art-design'), 10)
ON CONFLICT (slug) DO NOTHING;

-- Settings
INSERT INTO public.settings (id, site_name, tax_rate, default_currency)
VALUES ('global', 'READMART', 16.00, 'KES')
ON CONFLICT (id) DO NOTHING;

-- Analytics Data: Sample Orders
-- We use a dummy user_id for seeding if no profiles exist yet
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
    (order1_id, prod1_id, 1, 1200.00, '{"name": "The Alchemist", "price": 1200.00}'),
    (order1_id, prod2_id, 1, 3500.00, '{"name": "Clean Code", "price": 3500.00}');

    -- Create Sample Order 2 (Completed)
    INSERT INTO public.orders (user_id, status, total_amount, created_at)
    VALUES (dummy_user_id, 'completed', 1800.00, now() - interval '1 day')
    RETURNING id INTO order2_id;

    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase, product_snapshot)
    VALUES (order2_id, (SELECT id FROM public.products WHERE slug = 'zero-to-one'), 1, 1800.00, '{"name": "Zero to One", "price": 1800.00}');

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
