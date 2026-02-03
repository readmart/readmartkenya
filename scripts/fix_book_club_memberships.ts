
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixBookClubMemberships() {
  console.log('Fixing book club tables (clubs, club_members, book_club_memberships)...');

  const sql = `
  -- 1. Create clubs table if it doesn't exist
  CREATE TABLE IF NOT EXISTS public.clubs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    image_url text,
    founder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    membership_price numeric DEFAULT 0,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- 2. Create club_members table if it doesn't exist
  CREATE TABLE IF NOT EXISTS public.club_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'expired', 'cancelled')),
    payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'pending')),
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at timestamp with time zone,
    UNIQUE(user_id, club_id)
  );

  -- 3. Ensure book_club_memberships table exists (legacy support)
  CREATE TABLE IF NOT EXISTS public.book_club_memberships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    club_id uuid REFERENCES public.cms_content(id) ON DELETE CASCADE,
    tier text DEFAULT 'basic' CHECK (tier IN ('basic', 'premium', 'vip')),
    status text DEFAULT 'pending',
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, club_id)
  );

  -- 4. Enable RLS
  ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.book_club_memberships ENABLE ROW LEVEL SECURITY;

  -- 5. RLS Policies for clubs
  DROP POLICY IF EXISTS "Clubs are viewable by everyone" ON public.clubs;
  CREATE POLICY "Clubs are viewable by everyone" ON public.clubs
    FOR SELECT USING (is_active = true);

  -- 6. RLS Policies for club_members
  DROP POLICY IF EXISTS "Users can view their own club memberships" ON public.club_members;
  CREATE POLICY "Users can view their own club memberships" ON public.club_members
    FOR SELECT USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
  CREATE POLICY "Users can join clubs" ON public.club_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  -- 7. RLS Policies for book_club_memberships
  DROP POLICY IF EXISTS "Admins can view all memberships" ON public.book_club_memberships;
  CREATE POLICY "Admins can view all memberships" ON public.book_club_memberships
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'founder')
      )
    );

  DROP POLICY IF EXISTS "Users can view their own membership" ON public.book_club_memberships;
  CREATE POLICY "Users can view their own membership" ON public.book_club_memberships
    FOR SELECT USING (auth.uid() = user_id);

  -- 8. Notify PostgREST to reload schema
  NOTIFY pgrst, 'reload schema';
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      console.error('Error running SQL via RPC:', error);
      console.log('\n--- MANUAL SQL TO RUN IN SUPABASE DASHBOARD ---');
      console.log(sql);
      console.log('-----------------------------------------------\n');
      return;
    }
    console.log('Successfully updated book_club_memberships schema and policies.');
  } catch (err) {
    console.error('Failed to execute fix script:', err);
  }
}

fixBookClubMemberships();
