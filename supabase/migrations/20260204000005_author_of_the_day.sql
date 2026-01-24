
BEGIN;

-- Add Author of the Day columns to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS author_of_the_day_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS author_of_the_day_image text,
ADD COLUMN IF NOT EXISTS author_of_the_day_books uuid[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS author_of_the_day_enabled boolean DEFAULT false;

COMMIT;
