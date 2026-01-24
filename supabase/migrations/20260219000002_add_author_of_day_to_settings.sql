
-- Add Author of the Day columns to site_settings if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_id') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_id uuid REFERENCES public.profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_image') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_image text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_books') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_books uuid[] DEFAULT '{}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'site_settings' AND column_name = 'author_of_the_day_enabled') THEN
        ALTER TABLE public.site_settings ADD COLUMN author_of_the_day_enabled boolean DEFAULT false;
    END IF;
END $$;
