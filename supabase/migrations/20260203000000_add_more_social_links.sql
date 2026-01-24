-- Add YouTube and Threads URLs to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS youtube_url text,
ADD COLUMN IF NOT EXISTS threads_url text;

-- Update existing global settings with default values from constants
UPDATE public.site_settings
SET 
    youtube_url = 'https://www.youtube.com/@readmartke',
    threads_url = 'https://www.threads.net/@readmartke'
WHERE id = 'global' AND (youtube_url IS NULL OR threads_url IS NULL);
