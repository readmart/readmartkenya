-- Migration to enhance the promotion system with advanced tracking, governance, and impact analysis
-- Date: 2026-01-27

-- 1. Enhance promos table with new fields
ALTER TABLE public.promos 
ADD COLUMN IF NOT EXISTS promo_signature text UNIQUE,
ADD COLUMN IF NOT EXISTS impact_value decimal(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS predicted_impact decimal(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS utilization_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS start_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS command_logic jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'active', 'paused', 'expired', 'archived')),
ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- 2. Create promotion audit logs table
CREATE TABLE IF NOT EXISTS public.promo_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    promo_id uuid REFERENCES public.promos(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES auth.users(id),
    action text NOT NULL, -- 'create', 'update', 'approve', 'reject', 'pause', 'resume', 'delete', 'execute'
    previous_state jsonb,
    new_state jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create table for A/B testing and growth hacking metrics
CREATE TABLE IF NOT EXISTS public.promo_metrics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    promo_id uuid REFERENCES public.promos(id) ON DELETE CASCADE,
    metric_name text NOT NULL, -- 'conversion_rate', 'revenue_uplift', 'user_acquisition'
    metric_value decimal(12,4),
    variant_id text, -- for A/B testing ('A', 'B', 'control')
    recorded_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS on new tables
ALTER TABLE public.promo_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_metrics ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for promo_audit_logs (Admin only)
CREATE POLICY "Admins can view all promo audit logs"
ON public.promo_audit_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'founder')
    )
);

-- 6. RLS Policies for promo_metrics (Admin only)
CREATE POLICY "Admins can view all promo metrics"
ON public.promo_metrics FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'founder')
    )
);

-- 7. Trigger to automatically update utilization_count in promos when used (example logic)
-- Note: In a real system, this would be triggered by order completion or coupon redemption
CREATE OR REPLACE FUNCTION update_promo_utilization()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.promos
    SET utilization_count = utilization_count + 1
    WHERE id = NEW.promo_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_promos_status ON public.promos(status);
CREATE INDEX IF NOT EXISTS idx_promos_signature ON public.promos(promo_signature);
CREATE INDEX IF NOT EXISTS idx_promo_audit_logs_promo_id ON public.promo_audit_logs(promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_metrics_promo_id ON public.promo_metrics(promo_id);
