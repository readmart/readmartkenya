-- Migration: Enhance Agreement RLS Policies
-- Description: Allows users to update their own agreements for signing and adds missing policies.

BEGIN;

-- Allow users to update their own agreements (for signing)
DROP POLICY IF EXISTS "Users can update their own agreements" ON public.agreements;
CREATE POLICY "Users can update their own agreements" ON public.agreements
    FOR UPDATE USING (auth.uid() = partner_id);

-- Ensure Founders can manage all aspects of agreements
DROP POLICY IF EXISTS "Founders can manage all agreements" ON public.agreements;
CREATE POLICY "Founders can manage all agreements" ON public.agreements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'founder'
        )
    );

COMMIT;
