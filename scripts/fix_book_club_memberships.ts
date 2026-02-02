
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
  console.log('Fixing book_club_memberships table...');

  const sql = `
  -- 1. Ensure book_club_memberships table exists and has the status column
  DO $$ 
  BEGIN
    -- Create table if it doesn't exist (fallback)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_club_memberships') THEN
      CREATE TABLE public.book_club_memberships (
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
    ELSE
      -- Add status column if it's missing
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'book_club_memberships' AND column_name = 'status') THEN
        ALTER TABLE public.book_club_memberships ADD COLUMN status text DEFAULT 'pending';
      END IF;
    END IF;
  END $$;

  -- 2. Enable RLS
  ALTER TABLE public.book_club_memberships ENABLE ROW LEVEL SECURITY;

  -- 3. Ensure policies exist for admins/founders to view all memberships
  DO $$ 
  BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'book_club_memberships' AND policyname = 'Admins can view all memberships'
    ) THEN
        CREATE POLICY "Admins can view all memberships" ON public.book_club_memberships
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.profiles 
                    WHERE id = auth.uid() 
                    AND role IN ('admin', 'founder')
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'book_club_memberships' AND policyname = 'Users can view their own membership'
    ) THEN
        CREATE POLICY "Users can view their own membership" ON public.book_club_memberships
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
  END $$;

  -- 4. Notify PostgREST to reload schema
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
