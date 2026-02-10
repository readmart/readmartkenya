-- Migration: Comprehensive Partnership System Expansion
-- Description: Adds partnership tiers and partner profiles for a more robust management system.

BEGIN;

-- 1. Create Partnership Tiers Table
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

-- 2. Create Partner Profiles Table
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- 3. Enable RLS
ALTER TABLE public.partnership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Partnership Tiers
-- Public can view active tiers
DROP POLICY IF EXISTS "Public can view active tiers" ON public.partnership_tiers;
CREATE POLICY "Public can view active tiers" ON public.partnership_tiers
    FOR SELECT USING (is_active = true);

-- Admins/Founders can manage tiers
DROP POLICY IF EXISTS "Admins manage tiers" ON public.partnership_tiers;
CREATE POLICY "Admins manage tiers" ON public.partnership_tiers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

-- 5. RLS Policies for Partners
-- Public can view active partners
DROP POLICY IF EXISTS "Public can view active partners" ON public.partners;
CREATE POLICY "Public can view active partners" ON public.partners
    FOR SELECT USING (status = 'active');

-- Partners can update their own profile
DROP POLICY IF EXISTS "Partners can update own profile" ON public.partners;
CREATE POLICY "Partners can update own profile" ON public.partners
    FOR UPDATE USING (auth.uid() = user_id);

-- Admins/Founders can manage all partners
DROP POLICY IF EXISTS "Admins manage all partners" ON public.partners;
CREATE POLICY "Admins manage all partners" ON public.partners
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

-- 6. Seed Default Tiers
INSERT INTO public.partnership_tiers (name, description, benefits, color_code, display_order)
VALUES 
    ('Bronze', 'Standard partnership level for local hubs and service providers.', '["Access to partner resources", "Basic support"]', '#CD7F32', 1),
    ('Silver', 'Intermediate level with increased visibility and better commission rates.', '["Priority support", "Featured in partner directory", "Higher commission rates"]', '#C0C0C0', 2),
    ('Gold', 'Top-tier partnership for major logistics and technology partners.', '["Dedicated account manager", "Co-marketing opportunities", "Highest commission rates", "API access"]', '#FFD700', 3)
ON CONFLICT (name) DO NOTHING;

COMMIT;
