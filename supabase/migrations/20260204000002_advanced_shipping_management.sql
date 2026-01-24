-- ==========================================
-- Migration: Advanced Shipping Management
-- Target: shipping_zones
-- Description: Adds weight/volume surcharges, county field, and price validity control.
-- ==========================================

BEGIN;

-- 1. Add new columns to shipping_zones
DO $$ 
BEGIN
    -- Weight-based surcharge (per KG or fixed additional)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'weight_surcharge') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN weight_surcharge decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Volume-based surcharge (per cubic unit or fixed additional)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'volume_surcharge') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN volume_surcharge decimal(12,2) DEFAULT 0.00;
    END IF;

    -- Specific Kenyan County field for better grouping/filtering
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'county') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN county text;
    END IF;

    -- Price validity start date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'valid_from') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN valid_from timestamp with time zone DEFAULT now();
    END IF;

    -- Price validity end date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipping_zones' AND column_name = 'valid_until') THEN
        ALTER TABLE public.shipping_zones ADD COLUMN valid_until timestamp with time zone;
    END IF;
END $$;

-- 2. Add validation constraints
ALTER TABLE public.shipping_zones DROP CONSTRAINT IF EXISTS price_positive;
ALTER TABLE public.shipping_zones ADD CONSTRAINT price_positive CHECK (price >= 0);

ALTER TABLE public.shipping_zones DROP CONSTRAINT IF EXISTS weight_surcharge_positive;
ALTER TABLE public.shipping_zones ADD CONSTRAINT weight_surcharge_positive CHECK (weight_surcharge >= 0);

ALTER TABLE public.shipping_zones DROP CONSTRAINT IF EXISTS volume_surcharge_positive;
ALTER TABLE public.shipping_zones ADD CONSTRAINT volume_surcharge_positive CHECK (volume_surcharge >= 0);

-- 3. Map existing regions to counties for Kenyan towns
UPDATE public.shipping_zones
SET county = region
WHERE country_code = 'KE' AND county IS NULL;

-- 4. Create an audit log trigger if not already existing for shipping_zones
-- (Assuming audit_logs table exists from previous migrations)
CREATE OR REPLACE FUNCTION public.log_shipping_zone_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data, new_data)
        VALUES (
            auth.uid(),
            'UPDATE_SHIPPING_ZONE',
            'shipping_zones',
            OLD.id,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
        VALUES (
            auth.uid(),
            'CREATE_SHIPPING_ZONE',
            'shipping_zones',
            NEW.id,
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, old_data)
        VALUES (
            auth.uid(),
            'DELETE_SHIPPING_ZONE',
            'shipping_zones',
            OLD.id,
            to_jsonb(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_shipping_zone_changes ON public.shipping_zones;
CREATE TRIGGER tr_log_shipping_zone_changes
AFTER INSERT OR UPDATE OR DELETE ON public.shipping_zones
FOR EACH ROW EXECUTE FUNCTION public.log_shipping_zone_changes();

COMMIT;
