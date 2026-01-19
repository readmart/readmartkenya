-- Add type column to products if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'type') THEN
        ALTER TABLE public.products ADD COLUMN type TEXT DEFAULT 'physical' CHECK (type IN ('physical', 'ebook'));
    END IF;
END $$;
