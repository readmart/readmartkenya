
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function runMigration() {
  console.log('Running comprehensive schema synchronization...');

  const sql = `
  -- 1. Fix audit_logs
  DO $$ 
  BEGIN
    -- Rename columns if they exist with old names
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'resource') THEN
      ALTER TABLE public.audit_logs RENAME COLUMN resource TO entity_type;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'payload') THEN
      ALTER TABLE public.audit_logs RENAME COLUMN payload TO new_data;
    END IF;

    -- Add missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_id') THEN
      ALTER TABLE public.audit_logs ADD COLUMN entity_id text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'old_data') THEN
      ALTER TABLE public.audit_logs ADD COLUMN old_data jsonb DEFAULT '{}'::jsonb;
    END IF;
  END $$;

  -- 2. Fix promos
  DO $$ 
  BEGIN
    -- Handle 'type' vs 'discount_type'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'type') THEN
      -- If both exist, we might want to merge, but for now let's just ensure discount_type exists
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'discount_type') THEN
        ALTER TABLE public.promos RENAME COLUMN type TO discount_type;
      ELSE
        -- Both exist, maybe type is old. Let's make it nullable and remove NOT NULL if it has it
        ALTER TABLE public.promos ALTER COLUMN type DROP NOT NULL;
      END IF;
    END IF;

    -- Handle 'value' vs 'discount_value'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'value') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'discount_value') THEN
        ALTER TABLE public.promos RENAME COLUMN value TO discount_value;
      ELSE
        ALTER TABLE public.promos ALTER COLUMN value DROP NOT NULL;
      END IF;
    END IF;

    -- Ensure core columns exist with defaults to prevent NOT NULL violations
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'discount_type') THEN
      ALTER TABLE public.promos ADD COLUMN discount_type text DEFAULT 'percentage';
    END IF;
    ALTER TABLE public.promos ALTER COLUMN discount_type SET DEFAULT 'percentage';
    ALTER TABLE public.promos ALTER COLUMN discount_type DROP NOT NULL; -- Ensure it's not blocking

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'discount_value') THEN
      ALTER TABLE public.promos ADD COLUMN discount_value decimal(12,2) DEFAULT 0.00;
    END IF;
    ALTER TABLE public.promos ALTER COLUMN discount_value SET DEFAULT 0.00;
    ALTER TABLE public.promos ALTER COLUMN discount_value DROP NOT NULL; -- Ensure it's not blocking

    -- Fix 'code' column which was reported as violating not-null
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'code') THEN
      ALTER TABLE public.promos ALTER COLUMN code DROP NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'promo_signature') THEN
      ALTER TABLE public.promos ADD COLUMN promo_signature text;
    END IF;
    
    -- Ensure status exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promos' AND column_name = 'status') THEN
      ALTER TABLE public.promos ADD COLUMN status text DEFAULT 'draft';
    END IF;
  END $$;

  -- 3. Fix book_club_memberships
  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'book_club_memberships' AND column_name = 'status') THEN
      ALTER TABLE public.book_club_memberships ADD COLUMN status text DEFAULT 'pending';
    END IF;
  END $$;

  -- 4. Create missing tables
  CREATE TABLE IF NOT EXISTS public.promo_audit_logs (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      promo_id uuid REFERENCES public.promos(id) ON DELETE CASCADE,
      actor_id uuid REFERENCES auth.users(id),
      action text NOT NULL,
      old_state jsonb DEFAULT '{}'::jsonb,
      new_state jsonb DEFAULT '{}'::jsonb,
      created_at timestamp with time zone DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS public.promo_metrics (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      promo_id uuid REFERENCES public.promos(id) ON DELETE CASCADE,
      metric_type text NOT NULL,
      metric_value decimal(12,2) NOT NULL,
      recorded_at timestamp with time zone DEFAULT now()
  );

  -- 5. Reload schema cache
  NOTIFY pgrst, 'reload schema';
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('Migration failed:', error.message);
    // If exec_sql doesn't exist, we might need another way or tell user to run it
    console.log('Try running this SQL in your Supabase SQL Editor:');
    console.log(sql);
  } else {
    console.log('Migration completed successfully!');
  }
}

runMigration();
