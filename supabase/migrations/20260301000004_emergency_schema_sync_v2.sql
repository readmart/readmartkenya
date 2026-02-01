-- ==========================================
-- Migration: Emergency Schema Sync V2
-- Description: Adds missing columns to site_settings and profiles to resolve 400 errors
-- ==========================================

BEGIN;

-- 1. Ensure profiles has required columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS address text;

-- 2. Ensure site_settings has all required columns for the useSettings hook
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS secondary_phone text DEFAULT '+254 741 658 548',
ADD COLUMN IF NOT EXISTS tax_rate decimal(5,2) DEFAULT 16.00,
ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'KES',
ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS global_announcement text,
ADD COLUMN IF NOT EXISTS announcement_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS membership_wall_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS membership_price decimal(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS membership_duration_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS membership_title text DEFAULT 'ReadMart Premium Member',
ADD COLUMN IF NOT EXISTS membership_description text DEFAULT 'Get exclusive access to book clubs, insights, and early bird events.',
ADD COLUMN IF NOT EXISTS author_of_the_day_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS author_of_the_day_books uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS author_of_the_day_image text;

-- 3. Force schema reload for PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;
