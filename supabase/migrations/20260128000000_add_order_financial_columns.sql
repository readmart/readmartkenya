-- Add missing financial columns to orders table
DO $$ 
BEGIN
    -- Add subtotal_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'subtotal_amount') THEN
        ALTER TABLE public.orders ADD COLUMN subtotal_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Add tax_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.orders ADD COLUMN tax_amount decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Add shipping_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_amount') THEN
        ALTER TABLE public.orders ADD COLUMN shipping_amount decimal(12,2) DEFAULT 0.00;
    END IF;
END $$;
