-- ==========================================
-- Migration: Unified Settings, Clubs, Agreements & Kenyan Shipping Zones
-- ==========================================

BEGIN;

-- 1. Fix products schema
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.ebook_metadata ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Create dedicated clubs table
CREATE TABLE IF NOT EXISTS public.clubs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    image_url text,
    founder_id uuid REFERENCES public.profiles(id),
    membership_price decimal(12,2) DEFAULT 0.00,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create club_members table
CREATE TABLE IF NOT EXISTS public.club_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'expired', 'cancelled')),
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at timestamp with time zone,
    payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'pending')),
    UNIQUE(club_id, user_id)
);

-- 4. Create agreements table
CREATE TABLE IF NOT EXISTS public.agreements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    template_url text,
    partner_id uuid REFERENCES public.profiles(id),
    type text CHECK (type IN ('author', 'partner', 'general')),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'approved', 'rejected')),
    signed_url text,
    signed_at timestamp with time zone,
    approved_at timestamp with time zone,
    approved_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Enable RLS
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- 6. Policies for clubs
DROP POLICY IF EXISTS "Public can view active clubs" ON public.clubs;
CREATE POLICY "Public can view active clubs" ON public.clubs
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Founders can manage clubs" ON public.clubs;
CREATE POLICY "Founders can manage clubs" ON public.clubs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'founder'
        )
    );

-- 7. Policies for club_members
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.club_members;
CREATE POLICY "Users can view their own memberships" ON public.club_members
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Founders can manage all club members" ON public.club_members;
CREATE POLICY "Founders can manage all club members" ON public.club_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'founder'
        )
    );

-- 8. Policies for agreements
DROP POLICY IF EXISTS "Users can view their own agreements" ON public.agreements;
CREATE POLICY "Users can view their own agreements" ON public.agreements
    FOR SELECT USING (auth.uid() = partner_id);

DROP POLICY IF EXISTS "Founders can manage all agreements" ON public.agreements;
CREATE POLICY "Founders can manage all agreements" ON public.agreements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'founder'
        )
    );

-- 9. Populate shipping_zones with 200+ Kenyan locations
-- Grouped by County
INSERT INTO public.shipping_zones (name, country_code, region, county, price, estimated_days, is_active)
VALUES 
    -- Nairobi (1-20)
    ('Nairobi CBD', 'KE', 'Nairobi', 'Nairobi', 250, 1, true),
    ('Westlands', 'KE', 'Nairobi', 'Nairobi', 300, 1, true),
    ('Kilimani', 'KE', 'Nairobi', 'Nairobi', 300, 1, true),
    ('Lavington', 'KE', 'Nairobi', 'Nairobi', 350, 1, true),
    ('Karen', 'KE', 'Nairobi', 'Nairobi', 450, 1, true),
    ('Langata', 'KE', 'Nairobi', 'Nairobi', 300, 1, true),
    ('South C', 'KE', 'Nairobi', 'Nairobi', 300, 1, true),
    ('South B', 'KE', 'Nairobi', 'Nairobi', 300, 1, true),
    ('Embakasi', 'KE', 'Nairobi', 'Nairobi', 350, 1, true),
    ('Donholm', 'KE', 'Nairobi', 'Nairobi', 350, 1, true),
    ('Buruburu', 'KE', 'Nairobi', 'Nairobi', 350, 1, true),
    ('Pangani', 'KE', 'Nairobi', 'Nairobi', 300, 1, true),
    ('Eastleigh', 'KE', 'Nairobi', 'Nairobi', 300, 1, true),
    ('Parklands', 'KE', 'Nairobi', 'Nairobi', 300, 1, true),
    ('Gigiri', 'KE', 'Nairobi', 'Nairobi', 400, 1, true),
    ('Runda', 'KE', 'Nairobi', 'Nairobi', 450, 1, true),
    ('Muthaiga', 'KE', 'Nairobi', 'Nairobi', 450, 1, true),
    ('Kasarani', 'KE', 'Nairobi', 'Nairobi', 350, 1, true),
    ('Roysambu', 'KE', 'Nairobi', 'Nairobi', 350, 1, true),
    ('Kahawa West', 'KE', 'Nairobi', 'Nairobi', 400, 1, true),

    -- Kiambu (21-40)
    ('Kiambu Town', 'KE', 'Central', 'Kiambu', 350, 1, true),
    ('Thika CBD', 'KE', 'Central', 'Kiambu', 400, 1, true),
    ('Ruiru', 'KE', 'Central', 'Kiambu', 350, 1, true),
    ('Kikuyu', 'KE', 'Central', 'Kiambu', 400, 1, true),
    ('Limuru', 'KE', 'Central', 'Kiambu', 450, 1, true),
    ('Juja', 'KE', 'Central', 'Kiambu', 400, 1, true),
    ('Gatundu', 'KE', 'Central', 'Kiambu', 500, 2, true),
    ('Karuri', 'KE', 'Central', 'Kiambu', 400, 1, true),
    ('Githunguri', 'KE', 'Central', 'Kiambu', 450, 2, true),
    ('Kabete', 'KE', 'Central', 'Kiambu', 350, 1, true),
    ('Banana', 'KE', 'Central', 'Kiambu', 400, 1, true),
    ('Tigoni', 'KE', 'Central', 'Kiambu', 450, 1, true),
    ('Kimunyu', 'KE', 'Central', 'Kiambu', 450, 2, true),
    ('Kamirithu', 'KE', 'Central', 'Kiambu', 450, 2, true),
    ('Ndumberi', 'KE', 'Central', 'Kiambu', 400, 1, true),
    ('Kirigiti', 'KE', 'Central', 'Kiambu', 400, 1, true),
    ('Witeithie', 'KE', 'Central', 'Kiambu', 450, 1, true),
    ('Kiganjo', 'KE', 'Central', 'Kiambu', 450, 1, true),
    ('Ndeiya', 'KE', 'Central', 'Kiambu', 500, 2, true),
    ('Lari', 'KE', 'Central', 'Kiambu', 500, 2, true),

    -- Mombasa (41-60)
    ('Mombasa CBD', 'KE', 'Coast', 'Mombasa', 500, 2, true),
    ('Nyali', 'KE', 'Coast', 'Mombasa', 550, 2, true),
    ('Bamburi', 'KE', 'Coast', 'Mombasa', 600, 2, true),
    ('Likoni', 'KE', 'Coast', 'Mombasa', 650, 2, true),
    ('Changamwe', 'KE', 'Coast', 'Mombasa', 600, 2, true),
    ('Kisauni', 'KE', 'Coast', 'Mombasa', 600, 2, true),
    ('Mtwapa', 'KE', 'Coast', 'Kilifi', 650, 2, true),
    ('Tudor', 'KE', 'Coast', 'Mombasa', 550, 2, true),
    ('Mikindani', 'KE', 'Coast', 'Mombasa', 600, 2, true),
    ('Jomvu', 'KE', 'Coast', 'Mombasa', 600, 2, true),
    ('Shanzu', 'KE', 'Coast', 'Mombasa', 650, 2, true),
    ('Kiembeni', 'KE', 'Coast', 'Mombasa', 650, 2, true),
    ('Magongo', 'KE', 'Coast', 'Mombasa', 600, 2, true),
    ('Port Reitz', 'KE', 'Coast', 'Mombasa', 650, 2, true),
    ('Kongowea', 'KE', 'Coast', 'Mombasa', 550, 2, true),
    ('Miritini', 'KE', 'Coast', 'Mombasa', 650, 2, true),
    ('Bofu', 'KE', 'Coast', 'Mombasa', 650, 2, true),
    ('Mtongwe', 'KE', 'Coast', 'Mombasa', 700, 2, true),
    ('Shelly Beach', 'KE', 'Coast', 'Mombasa', 700, 2, true),
    ('Tiwi', 'KE', 'Coast', 'Kwale', 750, 2, true),

    -- Nakuru (61-80)
    ('Nakuru CBD', 'KE', 'Rift Valley', 'Nakuru', 450, 2, true),
    ('Naivasha Town', 'KE', 'Rift Valley', 'Nakuru', 400, 1, true),
    ('Molo Town', 'KE', 'Rift Valley', 'Nakuru', 550, 2, true),
    ('Gilgil', 'KE', 'Rift Valley', 'Nakuru', 450, 2, true),
    ('Njoro', 'KE', 'Rift Valley', 'Nakuru', 500, 2, true),
    ('Bahati', 'KE', 'Rift Valley', 'Nakuru', 500, 2, true),
    ('Rongai Nakuru', 'KE', 'Rift Valley', 'Nakuru', 550, 2, true),
    ('Subukia', 'KE', 'Rift Valley', 'Nakuru', 600, 2, true),
    ('Kuresoi', 'KE', 'Rift Valley', 'Nakuru', 650, 3, true),
    ('Elburgon', 'KE', 'Rift Valley', 'Nakuru', 550, 2, true),
    ('Salgaa', 'KE', 'Rift Valley', 'Nakuru', 500, 2, true),
    ('Mau Narok', 'KE', 'Rift Valley', 'Nakuru', 600, 2, true),
    ('Olenguruone', 'KE', 'Rift Valley', 'Nakuru', 700, 3, true),
    ('Lanet', 'KE', 'Rift Valley', 'Nakuru', 500, 2, true),
    ('Free Area', 'KE', 'Rift Valley', 'Nakuru', 450, 2, true),
    ('Kiamunyi', 'KE', 'Rift Valley', 'Nakuru', 500, 2, true),
    ('Milimani Nakuru', 'KE', 'Rift Valley', 'Nakuru', 500, 2, true),
    ('Shabab', 'KE', 'Rift Valley', 'Nakuru', 450, 2, true),
    ('Langa Langa', 'KE', 'Rift Valley', 'Nakuru', 450, 2, true),
    ('Section 58', 'KE', 'Rift Valley', 'Nakuru', 450, 2, true),

    -- Kisumu (81-100)
    ('Kisumu CBD', 'KE', 'Nyanza', 'Kisumu', 500, 2, true),
    ('Milimani Kisumu', 'KE', 'Nyanza', 'Kisumu', 550, 2, true),
    ('Kondele', 'KE', 'Nyanza', 'Kisumu', 500, 2, true),
    ('Riat Hills', 'KE', 'Nyanza', 'Kisumu', 600, 2, true),
    ('Kibos', 'KE', 'Nyanza', 'Kisumu', 550, 2, true),
    ('Manyatta', 'KE', 'Nyanza', 'Kisumu', 500, 2, true),
    ('Nyalenda', 'KE', 'Nyanza', 'Kisumu', 500, 2, true),
    ('Ahero', 'KE', 'Nyanza', 'Kisumu', 550, 2, true),
    ('Maseno', 'KE', 'Nyanza', 'Kisumu', 600, 2, true),
    ('Muhoroni', 'KE', 'Nyanza', 'Kisumu', 650, 2, true),
    ('Kombewa', 'KE', 'Nyanza', 'Kisumu', 650, 2, true),
    ('Katito', 'KE', 'Nyanza', 'Kisumu', 600, 2, true),
    ('Pap Onditi', 'KE', 'Nyanza', 'Kisumu', 650, 2, true),
    ('Sondu', 'KE', 'Nyanza', 'Kisumu', 600, 2, true),
    ('Chulaimbo', 'KE', 'Nyanza', 'Kisumu', 600, 2, true),
    ('Otonglo', 'KE', 'Nyanza', 'Kisumu', 550, 2, true),
    ('Mamboleo', 'KE', 'Nyanza', 'Kisumu', 550, 2, true),
    ('Obunga', 'KE', 'Nyanza', 'Kisumu', 500, 2, true),
    ('Bandani', 'KE', 'Nyanza', 'Kisumu', 500, 2, true),
    ('Kisian', 'KE', 'Nyanza', 'Kisumu', 550, 2, true),

    -- Uasin Gishu (101-120)
    ('Eldoret CBD', 'KE', 'Rift Valley', 'Uasin Gishu', 500, 2, true),
    ('Kapsoya', 'KE', 'Rift Valley', 'Uasin Gishu', 550, 2, true),
    ('Langas', 'KE', 'Rift Valley', 'Uasin Gishu', 500, 2, true),
    ('Kimumu', 'KE', 'Rift Valley', 'Uasin Gishu', 550, 2, true),
    ('Maili Tisa', 'KE', 'Rift Valley', 'Uasin Gishu', 600, 2, true),
    ('Turbo', 'KE', 'Rift Valley', 'Uasin Gishu', 650, 2, true),
    ('Burnt Forest', 'KE', 'Rift Valley', 'Uasin Gishu', 600, 2, true),
    ('Moiben', 'KE', 'Rift Valley', 'Uasin Gishu', 700, 3, true),
    ('Ziwa', 'KE', 'Rift Valley', 'Uasin Gishu', 700, 3, true),
    ('Soy', 'KE', 'Rift Valley', 'Uasin Gishu', 650, 2, true),
    ('Ainabkoi', 'KE', 'Rift Valley', 'Uasin Gishu', 700, 3, true),
    ('Matunda', 'KE', 'Rift Valley', 'Uasin Gishu', 650, 2, true),
    ('Kondoo', 'KE', 'Rift Valley', 'Uasin Gishu', 650, 2, true),
    ('Huruma Eldoret', 'KE', 'Rift Valley', 'Uasin Gishu', 500, 2, true),
    ('Munyaka', 'KE', 'Rift Valley', 'Uasin Gishu', 550, 2, true),
    ('Action', 'KE', 'Rift Valley', 'Uasin Gishu', 550, 2, true),
    ('West Indies Eldoret', 'KE', 'Rift Valley', 'Uasin Gishu', 550, 2, true),
    ('Elgon View', 'KE', 'Rift Valley', 'Uasin Gishu', 600, 2, true),
    ('Pioneer Eldoret', 'KE', 'Rift Valley', 'Uasin Gishu', 550, 2, true),
    ('Racecourse Eldoret', 'KE', 'Rift Valley', 'Uasin Gishu', 550, 2, true),

    -- Machakos (121-140)
    ('Machakos Town', 'KE', 'Eastern', 'Machakos', 400, 1, true),
    ('Athi River', 'KE', 'Eastern', 'Machakos', 350, 1, true),
    ('Syokimau', 'KE', 'Eastern', 'Machakos', 350, 1, true),
    ('Mlolongo', 'KE', 'Eastern', 'Machakos', 350, 1, true),
    ('Kathiani', 'KE', 'Eastern', 'Machakos', 450, 2, true),
    ('Masii', 'KE', 'Eastern', 'Machakos', 500, 2, true),
    ('Wamunyu', 'KE', 'Eastern', 'Machakos', 550, 2, true),
    ('Mwala', 'KE', 'Eastern', 'Machakos', 550, 2, true),
    ('Kangundo', 'KE', 'Eastern', 'Machakos', 500, 2, true),
    ('Tala', 'KE', 'Eastern', 'Machakos', 500, 2, true),
    ('Matungulu', 'KE', 'Eastern', 'Machakos', 550, 2, true),
    ('Yatta', 'KE', 'Eastern', 'Machakos', 600, 2, true),
    ('Matuu', 'KE', 'Eastern', 'Machakos', 550, 2, true),
    ('Kithimani', 'KE', 'Eastern', 'Machakos', 550, 2, true),
    ('Masinga', 'KE', 'Eastern', 'Machakos', 650, 2, true),
    ('Kyua', 'KE', 'Eastern', 'Machakos', 600, 2, true),
    ('Ikombe', 'KE', 'Eastern', 'Machakos', 650, 2, true),
    ('Kivaani', 'KE', 'Eastern', 'Machakos', 600, 2, true),
    ('Katangi', 'KE', 'Eastern', 'Machakos', 650, 2, true),
    ('Ekalakala', 'KE', 'Eastern', 'Machakos', 700, 3, true),

    -- Kajiado (141-160)
    ('Ngong Town', 'KE', 'Rift Valley', 'Kajiado', 350, 1, true),
    ('Ongata Rongai', 'KE', 'Rift Valley', 'Kajiado', 350, 1, true),
    ('Kitengela', 'KE', 'Rift Valley', 'Kajiado', 350, 1, true),
    ('Kajiado Town', 'KE', 'Rift Valley', 'Kajiado', 450, 2, true),
    ('Isinya', 'KE', 'Rift Valley', 'Kajiado', 400, 1, true),
    ('Namanga', 'KE', 'Rift Valley', 'Kajiado', 600, 2, true),
    ('Loitokitok', 'KE', 'Rift Valley', 'Kajiado', 750, 3, true),
    ('Kiserian', 'KE', 'Rift Valley', 'Kajiado', 400, 1, true),
    ('Matasia', 'KE', 'Rift Valley', 'Kajiado', 400, 1, true),
    ('Kimana', 'KE', 'Rift Valley', 'Kajiado', 700, 3, true),
    ('Mashuru', 'KE', 'Rift Valley', 'Kajiado', 650, 3, true),
    ('Bisil', 'KE', 'Rift Valley', 'Kajiado', 550, 2, true),
    ('Sultan Hamud', 'KE', 'Rift Valley', 'Kajiado', 500, 2, true),
    ('Emali', 'KE', 'Rift Valley', 'Kajiado', 550, 2, true),
    ('Kajiado Central', 'KE', 'Rift Valley', 'Kajiado', 500, 2, true),
    ('Kajiado West', 'KE', 'Rift Valley', 'Kajiado', 550, 2, true),
    ('Kajiado East', 'KE', 'Rift Valley', 'Kajiado', 500, 2, true),
    ('Kajiado North', 'KE', 'Rift Valley', 'Kajiado', 400, 1, true),
    ('Oloitokitok CBD', 'KE', 'Rift Valley', 'Kajiado', 750, 3, true),
    ('Magadi', 'KE', 'Rift Valley', 'Kajiado', 700, 3, true),

    -- Meru (161-180)
    ('Meru CBD', 'KE', 'Eastern', 'Meru', 500, 2, true),
    ('Nanyuki Town', 'KE', 'Rift Valley', 'Laikipia', 500, 2, true),
    ('Maua Town', 'KE', 'Eastern', 'Meru', 600, 2, true),
    ('Chuka Town', 'KE', 'Eastern', 'Tharaka-Nithi', 550, 2, true),
    ('Timau', 'KE', 'Eastern', 'Meru', 550, 2, true),
    ('Isiolo Town', 'KE', 'Eastern', 'Isiolo', 650, 2, true),
    ('Marsabit Town', 'KE', 'Eastern', 'Marsabit', 850, 4, true),
    ('Moyale', 'KE', 'Eastern', 'Marsabit', 1200, 5, true),
    ('Mikinduri', 'KE', 'Eastern', 'Meru', 600, 2, true),
    ('Laare', 'KE', 'Eastern', 'Meru', 650, 2, true),
    ('Nkubu', 'KE', 'Eastern', 'Meru', 550, 2, true),
    ('Mitunguu', 'KE', 'Eastern', 'Meru', 600, 2, true),
    ('Igoji', 'KE', 'Eastern', 'Meru', 600, 2, true),
    ('Kionyo', 'KE', 'Eastern', 'Meru', 600, 2, true),
    ('Gakoromone', 'KE', 'Eastern', 'Meru', 550, 2, true),
    ('Makutano Meru', 'KE', 'Eastern', 'Meru', 500, 2, true),
    ('Meru University Area', 'KE', 'Eastern', 'Meru', 550, 2, true),
    ('Kianjai', 'KE', 'Eastern', 'Meru', 600, 2, true),
    ('Ruiri', 'KE', 'Eastern', 'Meru', 650, 2, true),
    ('Giaki', 'KE', 'Eastern', 'Meru', 650, 2, true),

    -- Others (181-200+)
    ('Garissa Town', 'KE', 'North Eastern', 'Garissa', 800, 3, true),
    ('Wajir Town', 'KE', 'North Eastern', 'Wajir', 1000, 4, true),
    ('Mandera Town', 'KE', 'North Eastern', 'Mandera', 1500, 5, true),
    ('Lodwar Town', 'KE', 'Rift Valley', 'Turkana', 1200, 4, true),
    ('Kapenguria Town', 'KE', 'Rift Valley', 'West Pokot', 800, 3, true),
    ('Narok Town', 'KE', 'Rift Valley', 'Narok', 550, 2, true),
    ('Bomet Town', 'KE', 'Rift Valley', 'Bomet', 600, 2, true),
    ('Kericho Town', 'KE', 'Rift Valley', 'Kericho', 550, 2, true),
    ('Litein Town', 'KE', 'Rift Valley', 'Kericho', 600, 2, true),
    ('Sotik Town', 'KE', 'Rift Valley', 'Bomet', 650, 2, true),
    ('Kisii Town', 'KE', 'Nyanza', 'Kisii', 600, 2, true),
    ('Nyamira Town', 'KE', 'Nyanza', 'Nyamira', 600, 2, true),
    ('Migori Town', 'KE', 'Nyanza', 'Migori', 700, 3, true),
    ('Homa Bay Town', 'KE', 'Nyanza', 'Homa Bay', 700, 3, true),
    ('Siaya Town', 'KE', 'Nyanza', 'Siaya', 650, 2, true),
    ('Bondo Town', 'KE', 'Nyanza', 'Siaya', 700, 3, true),
    ('Busia Town', 'KE', 'Western', 'Busia', 700, 3, true),
    ('Vihiga Town', 'KE', 'Western', 'Vihiga', 600, 2, true),
    ('Mbale Town', 'KE', 'Western', 'Vihiga', 600, 2, true),
    ('Webuye Town', 'KE', 'Western', 'Bungoma', 650, 2, true),
    ('Kimilili Town', 'KE', 'Western', 'Bungoma', 700, 3, true),
    ('Malaba Border', 'KE', 'Western', 'Busia', 750, 3, true),
    ('Namwela', 'KE', 'Western', 'Bungoma', 750, 3, true),
    ('Sirisia', 'KE', 'Western', 'Bungoma', 750, 3, true),
    ('Chwele', 'KE', 'Western', 'Bungoma', 700, 3, true)
ON CONFLICT (name) DO NOTHING;

COMMIT;
