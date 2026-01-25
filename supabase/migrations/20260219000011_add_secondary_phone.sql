-- Add secondary_phone column to site_settings table
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS secondary_phone TEXT DEFAULT '+254 741 658 548';

-- Update existing row with the default value if it's null
UPDATE public.site_settings SET secondary_phone = '+254 741 658 548' WHERE secondary_phone IS NULL;
