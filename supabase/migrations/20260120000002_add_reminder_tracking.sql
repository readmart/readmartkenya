-- Add last_reminder_sent_at to profiles for abandoned cart tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamp with time zone;
