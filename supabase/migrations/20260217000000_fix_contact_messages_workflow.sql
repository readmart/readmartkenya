-- Fix contact_messages status constraint to align with Founder Dashboard UI
-- The UI uses 'New', 'In Progress', and 'Resolved'

BEGIN;

-- 1. Update the status constraint
ALTER TABLE public.contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_status_check 
    CHECK (status IN ('New', 'In Progress', 'Resolved'));

-- 2. Update existing records if any to match the new status system
UPDATE public.contact_messages SET status = 'New' WHERE status IN ('pending', 'read');
UPDATE public.contact_messages SET status = 'In Progress' WHERE status = 'replied';
UPDATE public.contact_messages SET status = 'Resolved' WHERE status = 'resolved';

-- 3. Ensure department column exists and has a default (already handled by previous migrations but safe to re-assert)
ALTER TABLE public.contact_messages ADD COLUMN IF NOT EXISTS department text DEFAULT 'General';

-- 4. Seed some sample inquiries for verification
INSERT INTO public.contact_messages (full_name, email, subject, message, department, status, priority)
VALUES 
    ('Jane Smith', 'jane@example.com', 'Partnership Inquiry (partners@readmartke.com)', 'I would like to discuss a potential partnership for our new bookstore chain.', 'Partnership Inquiry', 'New', 'High'),
    ('John Doe', 'john@example.com', 'Order Support (orders@readmartke.com)', 'My order #12345 has not arrived yet. Please check.', 'Order Support', 'In Progress', 'Medium'),
    ('Alice Wong', 'alice@example.com', 'General Inquiry (info@readmartke.com)', 'Do you have any signed copies of the new thriller by Stephen King?', 'General Inquiry', 'Resolved', 'Low');

COMMIT;
