
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

  -- 3. Fix book_club_members
  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'book_club_members' AND column_name = 'status') THEN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'book_club_members') THEN
        ALTER TABLE public.book_club_members ADD COLUMN status text DEFAULT 'active';
      END IF;
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

  -- 5. Fix products table
  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_published') THEN
      ALTER TABLE public.products ADD COLUMN is_published boolean DEFAULT true; 
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'type') THEN
      ALTER TABLE public.products ADD COLUMN type text DEFAULT 'physical';      
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'author') THEN
      ALTER TABLE public.products ADD COLUMN author text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_featured') THEN
      ALTER TABLE public.products ADD COLUMN is_featured boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'name') THEN
      ALTER TABLE public.products ADD COLUMN name text;
      -- Populate name from title if it exists
      UPDATE public.products SET name = title WHERE name IS NULL;
    END IF;
  END $$;

  -- 6. Fix shipping_zones table
  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_zones' AND column_name = 'rate') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_zones' AND column_name = 'price') THEN
        ALTER TABLE public.shipping_zones RENAME COLUMN price TO rate;
      ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_zones' AND column_name = 'base_rate') THEN
        ALTER TABLE public.shipping_zones RENAME COLUMN base_rate TO rate;
      ELSE
        ALTER TABLE public.shipping_zones ADD COLUMN rate decimal(12,2) DEFAULT 0.00;
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipping_zones' AND column_name = 'estimated_days') THEN
      ALTER TABLE public.shipping_zones ADD COLUMN estimated_days integer DEFAULT 3;
    END IF;
  END $$;

  -- 7. Fix site_settings table
  CREATE TABLE IF NOT EXISTS public.site_settings (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      site_name text DEFAULT 'ReadMart',
      created_at timestamp with time zone DEFAULT now()
  );

  DO $$ 
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'site_logo') THEN
      ALTER TABLE public.site_settings ADD COLUMN site_logo text DEFAULT '/assets/logo.jpg';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'whatsapp_link') THEN
      ALTER TABLE public.site_settings ADD COLUMN whatsapp_link text DEFAULT 'https://wa.me/254794129958';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'contact_email') THEN
      ALTER TABLE public.site_settings ADD COLUMN contact_email text DEFAULT 'hello@readmart.com';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'contact_phone') THEN
      ALTER TABLE public.site_settings ADD COLUMN contact_phone text DEFAULT '+254 794 129 958';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'secondary_phone') THEN
      ALTER TABLE public.site_settings ADD COLUMN secondary_phone text DEFAULT '+254 741 658 548';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'address') THEN
      ALTER TABLE public.site_settings ADD COLUMN address text DEFAULT 'Nairobi, Kenya';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'working_hours') THEN
      ALTER TABLE public.site_settings ADD COLUMN working_hours text DEFAULT 'Mon-Fri: 8am - 5pm';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'tax_rate') THEN
      ALTER TABLE public.site_settings ADD COLUMN tax_rate decimal(5,2) DEFAULT 16.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'default_currency') THEN
      ALTER TABLE public.site_settings ADD COLUMN default_currency text DEFAULT 'KES';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'maintenance_mode') THEN
      ALTER TABLE public.site_settings ADD COLUMN maintenance_mode boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'instagram_url') THEN
      ALTER TABLE public.site_settings ADD COLUMN instagram_url text DEFAULT 'https://www.instagram.com/readmartke';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'facebook_url') THEN
      ALTER TABLE public.site_settings ADD COLUMN facebook_url text DEFAULT 'https://www.facebook.com/share/1LB4jKLTTV/';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'x_url') THEN
      ALTER TABLE public.site_settings ADD COLUMN x_url text DEFAULT 'https://x.com/readmartke';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'linkedin_url') THEN
      ALTER TABLE public.site_settings ADD COLUMN linkedin_url text DEFAULT 'https://linkedin.com/comm/mynetwork/discovery-see-all?usecase=PEOPLE_FOLLOWS&followMember=read-mart-6797423a1';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'tiktok_url') THEN
      ALTER TABLE public.site_settings ADD COLUMN tiktok_url text DEFAULT 'https://www.tiktok.com/@readmartke';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'threads_url') THEN
      ALTER TABLE public.site_settings ADD COLUMN threads_url text DEFAULT 'https://www.threads.net/@readmartke';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'global_announcement') THEN
      ALTER TABLE public.site_settings ADD COLUMN global_announcement text DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'announcement_active') THEN
      ALTER TABLE public.site_settings ADD COLUMN announcement_active boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'membership_wall_active') THEN
      ALTER TABLE public.site_settings ADD COLUMN membership_wall_active boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'membership_price') THEN
      ALTER TABLE public.site_settings ADD COLUMN membership_price decimal(12,2) DEFAULT 1000.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'membership_duration_days') THEN
      ALTER TABLE public.site_settings ADD COLUMN membership_duration_days integer DEFAULT 30;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'membership_title') THEN
      ALTER TABLE public.site_settings ADD COLUMN membership_title text DEFAULT 'ReadMart Premium Member';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'membership_description') THEN
      ALTER TABLE public.site_settings ADD COLUMN membership_description text DEFAULT 'Get exclusive access to book clubs, insights, and early bird events.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'author_of_the_day_id') THEN
      ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'author_of_the_day_enabled') THEN
      ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_enabled boolean DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'author_of_the_day_books') THEN
      ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_books text[] DEFAULT '{}'::text[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_settings' AND column_name = 'author_of_the_day_image') THEN
      ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_image text;
    END IF;
  END $$;

  -- Ensure at least one settings row exists
  INSERT INTO public.site_settings (site_name)
  SELECT 'ReadMart'
  WHERE NOT EXISTS (SELECT 1 FROM public.site_settings);

  -- 8. Fix partnership tables
  DO $$ 
  BEGIN
    -- Fix partnership_tiers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partnership_tiers' AND column_name = 'color_code') THEN
      ALTER TABLE public.partnership_tiers ADD COLUMN color_code text DEFAULT '#808080';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partnership_tiers' AND column_name = 'display_order') THEN
      ALTER TABLE public.partnership_tiers ADD COLUMN display_order integer DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partnership_tiers' AND column_name = 'is_active') THEN
      ALTER TABLE public.partnership_tiers ADD COLUMN is_active boolean DEFAULT true;
    END IF;

    -- Fix partners
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'category') THEN
      ALTER TABLE public.partners ADD COLUMN category text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'status') THEN
      ALTER TABLE public.partners ADD COLUMN status text DEFAULT 'active';
    END IF;

    -- 10. Fix profiles table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
      ALTER TABLE public.profiles ADD COLUMN phone text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address') THEN
      ALTER TABLE public.profiles ADD COLUMN address text;
    END IF;
  END $$;

  -- 9. Reload schema cache
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
