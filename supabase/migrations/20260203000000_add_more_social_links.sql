-- Add YouTube, Threads, and TikTok URLs to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS youtube_url text,
ADD COLUMN IF NOT EXISTS threads_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text;

-- Update existing global settings with default values from constants
UPDATE public.site_settings
SET 
    youtube_url = 'https://www.youtube.com/@readmartke',
    threads_url = 'https://www.threads.com/@readmartke',
    tiktok_url = 'https://www.tiktok.com/@readmartke?_r=1&_t=ZS-92BvAtTmKLn'
WHERE id = 'global' AND (youtube_url IS NULL OR threads_url IS NULL OR tiktok_url IS NULL);
