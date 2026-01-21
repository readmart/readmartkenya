-- ==========================================
-- Migration: Fix Payouts, Authors and Application Workflow
-- Target: fulfillment_ledger, profiles, applications
-- ==========================================

BEGIN;

-- 1. Ensure dependent tables exist before fulfillment_ledger
CREATE TABLE IF NOT EXISTS public.partnership_agreements (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  type text check (type in ('author', 'service_provider')) not null,
  is_active boolean default true,
  version text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.partnership_services (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  commission_rate decimal(5,2),
  fixed_fee decimal(12,2),
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.author_applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  agreement_id uuid references public.partnership_agreements(id),
  full_name text not null,
  email text not null,
  bio text,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.partnership_applications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  agreement_id uuid references public.partnership_agreements(id),
  full_name text not null,
  email text not null,
  organization text,
  service_type text,
  description text,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for newly created tables
ALTER TABLE public.partnership_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_applications ENABLE ROW LEVEL SECURITY;

-- Basic policies for applications
DO $$ 
BEGIN
    -- Partnership Agreements
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partnership_agreements' AND policyname = 'Anyone can view active agreements') THEN
        CREATE POLICY "Anyone can view active agreements" ON public.partnership_agreements FOR SELECT USING (is_active = true);
    END IF;

    -- Author Applications
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'author_applications' AND policyname = 'Users can view their own author applications') THEN
        CREATE POLICY "Users can view their own author applications" ON public.author_applications FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'author_applications' AND policyname = 'Users can insert their own author applications') THEN
        CREATE POLICY "Users can insert their own author applications" ON public.author_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Partnership Applications
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partnership_applications' AND policyname = 'Users can view their own applications') THEN
        CREATE POLICY "Users can view their own applications" ON public.partnership_applications FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'partnership_applications' AND policyname = 'Users can insert their own applications') THEN
        CREATE POLICY "Users can insert their own applications" ON public.partnership_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 2. Ensure fulfillment_ledger exists and enhance with partner_id
CREATE TABLE IF NOT EXISTS public.fulfillment_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) NOT NULL,
    partner_service_id uuid REFERENCES public.partnership_services(id),
    amount decimal(12,2) NOT NULL,
    payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'failed')),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$ 
BEGIN
    -- Add partner_id to fulfillment_ledger
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fulfillment_ledger' AND column_name = 'partner_id') THEN
        ALTER TABLE public.fulfillment_ledger ADD COLUMN partner_id uuid REFERENCES public.profiles(id);
    END IF;

    -- Add partner_id to shipping_zones to link zones to logistics partners
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'partner_id') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN partner_id uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE public.fulfillment_ledger ENABLE ROW LEVEL SECURITY;

-- 3. Ensure site_settings exists and has required columns
CREATE TABLE IF NOT EXISTS public.site_settings (
    id text PRIMARY KEY DEFAULT 'global',
    site_name text DEFAULT 'ReadMart',
    site_logo text DEFAULT '/assets/logo.jpg',
    whatsapp_link text DEFAULT 'https://wa.me/254700000000',
    contact_email text DEFAULT 'hello@readmart.com',
    contact_phone text DEFAULT '+254 700 000 000',
    address text DEFAULT 'Nairobi, Kenya',
    tax_rate decimal(5,2) DEFAULT 16.00,
    author_commission_rate decimal(5,2) DEFAULT 70.00,
    default_currency text DEFAULT 'KES',
    maintenance_mode boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure author_commission_rate exists if table was created previously without it
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS author_commission_rate decimal(5,2) DEFAULT 70.00;

-- Initialize Global Settings row if missing
INSERT INTO public.site_settings (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Policies for site_settings
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Site settings are viewable by everyone" ON public.site_settings;
    DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
END $$;

CREATE POLICY "Site settings are viewable by everyone" ON public.site_settings
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage site settings" ON public.site_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

-- 4. Trigger for Auto-Updating User Roles on Application Approval
CREATE OR REPLACE FUNCTION public.handle_application_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if status changed to approved
    IF (NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved')) THEN
        -- Check if it's an author application
        IF (TG_TABLE_NAME = 'author_applications') THEN
            UPDATE public.profiles 
            SET role = 'author' 
            WHERE id = NEW.user_id;
        -- Check if it's a partnership application
        ELSIF (TG_TABLE_NAME = 'partnership_applications') THEN
            UPDATE public.profiles 
            SET role = 'partner' 
            WHERE id = NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers to both tables
DROP TRIGGER IF EXISTS tr_author_approval ON public.author_applications;
CREATE TRIGGER tr_author_approval
    AFTER UPDATE OF status ON public.author_applications
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_application_approval();

DROP TRIGGER IF EXISTS tr_partner_approval ON public.partnership_applications;
CREATE TRIGGER tr_partner_approval
    AFTER UPDATE OF status ON public.partnership_applications
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_application_approval();

-- 4. Fix RLS for fulfillment_ledger to allow partners to view their own payouts
DROP POLICY IF EXISTS "Partners can view their own payouts" ON public.fulfillment_ledger;
CREATE POLICY "Partners can view their own payouts" ON public.fulfillment_ledger
    FOR SELECT USING (
        auth.uid() = partner_id OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
    );

COMMIT;
