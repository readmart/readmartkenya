
-- Migration: Secure Profiles PII Exposure
-- Description: Restricts the profiles table to owners/admins and creates a public view for limited information.

BEGIN;

-- 1. Create a public view for profiles that excludes sensitive data (phone, address, preferences)
-- This view allows the frontend to still fetch basic info (name, avatar, bio) for public pages/community.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
    id, 
    full_name, 
    avatar_url, 
    role, 
    bio, 
    created_at
FROM public.profiles;

-- 2. Grant SELECT access on the view to everyone (anon and authenticated)
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 3. Drop the overly permissive policy on the main profiles table
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- 4. Create a more restrictive policy for the main profiles table
-- Users can see their own full profile, and admins/founders can see everything.
DROP POLICY IF EXISTS "Profiles are viewable by owner or admin" ON public.profiles;
CREATE POLICY "Profiles are viewable by owner or admin" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id 
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'founder')
        )
    );

COMMIT;
