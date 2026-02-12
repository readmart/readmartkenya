
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
  console.log('Fixing book club tables (book_clubs, book_club_members)...');

  const sql = `
  -- 1. Ensure book_clubs table exists
  CREATE TABLE IF NOT EXISTS public.book_clubs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    image_url text,
    founder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    membership_price numeric DEFAULT 0,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- 2. Ensure book_club_members table exists
  CREATE TABLE IF NOT EXISTS public.book_club_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    club_id uuid REFERENCES public.book_clubs(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'invited', 'banned')),
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(club_id, user_id)
  );

  -- 3. Enable RLS
  ALTER TABLE public.book_clubs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.book_club_members ENABLE ROW LEVEL SECURITY;

  -- 4. RLS Policies for book_clubs
  DROP POLICY IF EXISTS "Book clubs are viewable by everyone" ON public.book_clubs;
  CREATE POLICY "Book clubs are viewable by everyone" ON public.book_clubs
    FOR SELECT USING (is_active = true);

  -- 5. RLS Policies for book_club_members
  DROP POLICY IF EXISTS "Users can view their own club memberships" ON public.book_club_members;
  CREATE POLICY "Users can view their own club memberships" ON public.book_club_members
    FOR SELECT USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can join book clubs" ON public.book_club_members;
  CREATE POLICY "Users can join book clubs" ON public.book_club_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Admins can manage club members" ON public.book_club_members;
  CREATE POLICY "Admins can manage club members" ON public.book_club_members
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'founder')
      )
    );

  -- 6. Notify PostgREST to reload schema
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
    console.log('Successfully updated book_club_members schema and policies.');
  } catch (err) {
    console.error('Failed to execute fix script:', err);
  }
}

fixBookClubMemberships();
