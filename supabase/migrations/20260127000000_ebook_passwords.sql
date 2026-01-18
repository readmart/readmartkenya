-- Add type column to products if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'type') THEN
        ALTER TABLE public.products ADD COLUMN type TEXT DEFAULT 'physical' CHECK (type IN ('physical', 'ebook'));
    END IF;
END $$;

-- Add password column to ebook_metadata
ALTER TABLE public.ebook_metadata ADD COLUMN password TEXT;

-- Update existing ebooks to have a default password if needed (optional)
-- UPDATE public.ebook_metadata SET password = 'ReadMart' || SUBSTRING(id::text, 1, 4) WHERE password IS NULL;
