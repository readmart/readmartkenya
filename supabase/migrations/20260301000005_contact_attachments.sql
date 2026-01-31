-- ==========================================
-- Migration: Contact Attachments Support
-- Target: Storage (contact_attachments), Tables (contact_messages)
-- Description: Adds storage for contact form attachments and updates schema.
-- ==========================================

BEGIN;

-- 1. Create contact_attachments bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact_attachments', 'contact_attachments', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2. Add RLS for contact_attachments
-- Allow public to upload (for the contact form)
CREATE POLICY "Public Upload Contact Attachments" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'contact_attachments' AND
    (storage.foldername(name))[1] IS NULL -- Files are in the root
  );

-- Allow admins to view/manage contact attachments
CREATE POLICY "Admin Full Access to contact_attachments" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'contact_attachments' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  )
  WITH CHECK (
    bucket_id = 'contact_attachments' AND 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('founder', 'admin')))
  );

-- 3. Update contact_messages table
ALTER TABLE public.contact_messages 
ADD COLUMN IF NOT EXISTS attachment_url text;

-- Force schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
