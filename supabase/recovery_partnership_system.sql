-- ==========================================
-- RECOVERY SCRIPT: Partnership System
-- Target: partnership_tiers, partners, partnership_applications, author_applications, 
--         partnership_agreements, agreements, partnership_services, fulfillment_ledger
-- Description: Restores the complete database schema, security policies, and automation 
--              for the ReadMart Partnership Module after accidental deletion.
-- ==========================================

BEGIN;

-- 1. ENSURE FOUNDATIONAL TABLES EXIST
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
    full_name text,
    avatar_url text,
    email text,
    role text DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'founder', 'author', 'partner')),
    bio text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PARTNERSHIP CONFIGURATION TABLES
CREATE TABLE IF NOT EXISTS public.partnership_tiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    benefits JSONB DEFAULT '[]'::JSONB,
    min_requirement TEXT,
    color_code TEXT DEFAULT '#808080',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.partnership_services (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    commission_rate decimal(5,2),
    fixed_fee decimal(12,2),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. PARTNER PROFILES
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL UNIQUE,
    tier_id UUID REFERENCES public.partnership_tiers(id) ON DELETE SET NULL,
    company_name TEXT NOT NULL,
    logo_url TEXT,
    website_url TEXT,
    description TEXT,
    category TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    social_links JSONB DEFAULT '{}'::JSONB,
    is_featured BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. AGREEMENT TEMPLATES AND INSTANCES
CREATE TABLE IF NOT EXISTS public.partnership_agreements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    type text CHECK (type IN ('author', 'partner', 'service_provider', 'general')) NOT NULL,
    is_active boolean DEFAULT true,
    version text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agreements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    template_url text,
    partner_id uuid REFERENCES public.profiles(id),
    protocol_id uuid REFERENCES public.partnership_agreements(id),
    type text CHECK (type IN ('author', 'partner', 'general')),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'approved', 'rejected')),
    signed_url text,
    signed_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by uuid REFERENCES public.profiles(id),
    key_terms jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(partner_id, type)
);

-- 5. APPLICATION WORKFLOW
CREATE TABLE IF NOT EXISTS public.author_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    agreement_id uuid REFERENCES public.partnership_agreements(id),
    full_name text NOT NULL,
    email text NOT NULL,
    bio text,
    status text CHECK (status IN ('pending', 'approved', 'rejected', 'agreement_sent', 'completed')) DEFAULT 'pending',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.partnership_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    agreement_id uuid REFERENCES public.partnership_agreements(id),
    full_name text NOT NULL,
    email text NOT NULL,
    organization text,
    service_type text,
    description text,
    status text CHECK (status IN ('pending', 'approved', 'rejected', 'agreement_sent', 'completed')) DEFAULT 'pending',
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. OPERATION & LEDGER
CREATE TABLE IF NOT EXISTS public.fulfillment_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid NOT NULL, -- references public.orders(id) if it exists
    partner_service_id uuid REFERENCES public.partnership_services(id),
    partner_id uuid REFERENCES public.profiles(id),
    amount decimal(12,2) NOT NULL,
    payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'failed')),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. ENABLE RLS
ALTER TABLE public.partnership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillment_ledger ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES
-- Partnership Tiers
DROP POLICY IF EXISTS "Public can view active tiers" ON public.partnership_tiers;
CREATE POLICY "Public can view active tiers" ON public.partnership_tiers FOR SELECT USING (is_active = true);

-- Partners
DROP POLICY IF EXISTS "Public can view active partners" ON public.partners;
CREATE POLICY "Public can view active partners" ON public.partners FOR SELECT USING (status = 'active');
DROP POLICY IF EXISTS "Partners can update own profile" ON public.partners;
CREATE POLICY "Partners can update own profile" ON public.partners FOR UPDATE USING (auth.uid() = user_id);

-- Agreements
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.partnership_agreements;
CREATE POLICY "Anyone can view active templates" ON public.partnership_agreements FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Users can view their own agreements" ON public.agreements;
CREATE POLICY "Users can view their own agreements" ON public.agreements FOR SELECT USING (auth.uid() = partner_id);

-- Applications
DROP POLICY IF EXISTS "Users can view own author app" ON public.author_applications;
CREATE POLICY "Users can view own author app" ON public.author_applications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own author app" ON public.author_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own partner app" ON public.partnership_applications;
CREATE POLICY "Users can view own partner app" ON public.partnership_applications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own partner app" ON public.partnership_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ledger
DROP POLICY IF EXISTS "Partners can view own payouts" ON public.fulfillment_ledger;
CREATE POLICY "Partners can view own payouts" ON public.fulfillment_ledger FOR SELECT USING (auth.uid() = partner_id);

-- Admin Management (Universal Policy for Admins)
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN 
        ('partnership_tiers', 'partnership_services', 'partners', 'partnership_agreements', 'agreements', 'author_applications', 'partnership_applications', 'fulfillment_ledger')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins manage %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Admins manage %I" ON public.%I FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''founder'')))', t, t);
    END LOOP;
END $$;

-- 9. AUTOMATION LOGIC (FUNCTIONS & TRIGGERS)

-- A. Auto-create Partner Record on Role Change
CREATE OR REPLACE FUNCTION public.handle_partner_role_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.role = 'partner' AND (OLD.role IS NULL OR OLD.role != 'partner')) THEN
        INSERT INTO public.partners (user_id, company_name, contact_email, status)
        VALUES (NEW.id, COALESCE(NEW.full_name, 'New Partner'), NEW.email, 'active')
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_partner_role_change ON public.profiles;
CREATE TRIGGER on_partner_role_change
    AFTER UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_partner_role_change();

-- B. Sync Agreement Signature to Application and Role
CREATE OR REPLACE FUNCTION public.sync_agreement_to_application()
RETURNS TRIGGER AS $$
DECLARE
    v_table text;
BEGIN
    IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
        v_table := CASE 
            WHEN NEW.type = 'author' THEN 'author_applications'
            WHEN NEW.type = 'partner' THEN 'partnership_applications'
            ELSE NULL
        END;

        IF v_table IS NOT NULL THEN
            EXECUTE format('UPDATE public.%I SET status = ''completed'', metadata = jsonb_set(COALESCE(metadata, ''{}''::jsonb), ''{signed_at}'', %L) WHERE user_id = $1', v_table, quote_literal(now()))
            USING NEW.partner_id;

            UPDATE public.profiles 
            SET role = CASE WHEN NEW.type = 'author' THEN 'author' ELSE 'partner' END
            WHERE id = NEW.partner_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_agreement_status ON public.agreements;
CREATE TRIGGER tr_sync_agreement_status
    AFTER UPDATE OF status ON public.agreements
    FOR EACH ROW EXECUTE PROCEDURE public.sync_agreement_to_application();

-- 10. SEED DEFAULT DATA
INSERT INTO public.partnership_tiers (name, description, benefits, color_code, display_order)
VALUES 
    ('Bronze', 'Standard partnership level.', '["Access to partner resources", "Basic support"]', '#CD7F32', 1),
    ('Silver', 'Intermediate level.', '["Priority support", "Featured in directory"]', '#C0C0C0', 2),
    ('Gold', 'Top-tier partnership.', '["Dedicated account manager", "API access"]', '#FFD700', 3)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.partnership_services (name, description, commission_rate, is_active)
VALUES 
    ('Logistics Partner', 'Local delivery and fulfillment services.', 10.00, true),
    ('Content Partner', 'Book reviews, summaries and marketing content.', 5.00, true),
    ('Book Club Partner', 'Community hub for readers.', 15.00, true)
ON CONFLICT (name) DO NOTHING;

-- 11. REFRESH CACHE
NOTIFY pgrst, 'reload schema';

COMMIT;
