-- ==========================================
-- Migration: Add Missing Dashboard Columns
-- Target: site_settings, cms_content
-- Description: Adds columns required for Identity and Banners tabs.
-- ==========================================

BEGIN;

-- 1. Add columns to site_settings
ALTER TABLE public.site_settings 
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS x_url text,
ADD COLUMN IF NOT EXISTS linkedin_url text,
ADD COLUMN IF NOT EXISTS youtube_url text,
ADD COLUMN IF NOT EXISTS threads_url text,
ADD COLUMN IF NOT EXISTS hero_image_url text;

-- 2. Add columns to cms_content
ALTER TABLE public.cms_content 
ADD COLUMN IF NOT EXISTS link_url text;

-- 3. Force schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
