import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupCheckoutSessions() {
  console.log('Running checkout_sessions setup...');

  const sql = `
  -- 1. Create checkout_sessions table
  CREATE TABLE IF NOT EXISTS public.checkout_sessions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid REFERENCES public.profiles(id),
      email text,
      phone text,
      cart_data jsonb,
      shipping_zone_id uuid REFERENCES public.shipping_zones(id),
      status text DEFAULT 'initiated' CHECK (status IN ('initiated', 'shipping_completed', 'payment_initiated', 'completed', 'abandoned')),
      last_step text,
      metadata jsonb,
      created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
      updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- 2. Add columns if missing (idempotent)
  DO $$ 
  BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'checkout_sessions' AND column_name = 'shipping_zone_id') THEN
          ALTER TABLE public.checkout_sessions ADD COLUMN shipping_zone_id uuid REFERENCES public.shipping_zones(id);
      END IF;
  END $$;

  -- 3. Enable RLS
  ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

  -- 4. Policies
  DROP POLICY IF EXISTS "Users can manage their own checkout sessions" ON public.checkout_sessions;
  CREATE POLICY "Users can manage their own checkout sessions" ON public.checkout_sessions
      FOR ALL USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Anyone can create a checkout session" ON public.checkout_sessions;
  CREATE POLICY "Anyone can create a checkout session" ON public.checkout_sessions
      FOR INSERT WITH CHECK (true);

  DROP POLICY IF EXISTS "Founders can view all checkout sessions" ON public.checkout_sessions;
  CREATE POLICY "Founders can view all checkout sessions" ON public.checkout_sessions
      FOR SELECT USING (
          EXISTS (
              SELECT 1 FROM public.profiles 
              WHERE id = auth.uid() 
              AND role = 'founder'
          )
      );

  -- 5. Trigger for updated_at
  CREATE OR REPLACE FUNCTION public.handle_updated_at()
  RETURNS TRIGGER AS $$
  BEGIN
      NEW.updated_at = now();
      RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS set_checkout_sessions_updated_at ON public.checkout_sessions;
  CREATE TRIGGER set_checkout_sessions_updated_at
      BEFORE UPDATE ON public.checkout_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();

  -- 6. Grant access
  GRANT ALL ON public.checkout_sessions TO authenticated;
  GRANT ALL ON public.checkout_sessions TO anon;
  GRANT ALL ON public.checkout_sessions TO service_role;

  -- 7. Reload schema cache
  NOTIFY pgrst, 'reload schema';
  `;

  // Try executing via RPC if available, otherwise print instructions
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Migration failed via RPC:', error.message);
    console.log('\nPlease run the following SQL in your Supabase SQL Editor:');
    console.log('---');
    console.log(sql);
    console.log('---');
  } else {
    console.log('Migration completed successfully!');
  }
}

setupCheckoutSessions();
