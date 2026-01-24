-- Create ebook_metadata table
CREATE TABLE IF NOT EXISTS public.ebook_metadata (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    file_path text NOT NULL,
    format text DEFAULT 'pdf',
    page_count integer,
    file_size_bytes bigint,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.ebook_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- 1. Admins/Founders can manage all metadata
CREATE POLICY "Admins can manage ebook metadata"
ON public.ebook_metadata
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'founder')
    )
);

-- 2. Authors can manage metadata for their own products
CREATE POLICY "Authors can manage their ebook metadata"
ON public.ebook_metadata
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = public.ebook_metadata.product_id
        AND p.author_id = auth.uid()
    )
);

-- 3. Public/Purchasers can view metadata (needed for shop display)
CREATE POLICY "Ebook metadata is viewable by everyone"
ON public.ebook_metadata
FOR SELECT
USING (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ebook_metadata_updated_at
    BEFORE UPDATE ON public.ebook_metadata
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
