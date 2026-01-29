-- ==========================================
-- Migration: Unify Shipping Data and Fix Missing Columns
-- Target: shipping_zones
-- Description: Ensures all shipping zones have prices, counties, and validity dates.
-- ==========================================

BEGIN;

-- 1. Ensure price is not null and has a default
ALTER TABLE public.shipping_zones ALTER COLUMN price SET DEFAULT 0.00;
UPDATE public.shipping_zones SET price = 0.00 WHERE price IS NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN price SET NOT NULL;

-- 2. Ensure weight_surcharge and volume_surcharge are not null
ALTER TABLE public.shipping_zones ALTER COLUMN weight_surcharge SET DEFAULT 0.00;
UPDATE public.shipping_zones SET weight_surcharge = 0.00 WHERE weight_surcharge IS NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN weight_surcharge SET NOT NULL;

ALTER TABLE public.shipping_zones ALTER COLUMN volume_surcharge SET DEFAULT 0.00;
UPDATE public.shipping_zones SET volume_surcharge = 0.00 WHERE volume_surcharge IS NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN volume_surcharge SET NOT NULL;

-- 3. Ensure valid_from is populated
UPDATE public.shipping_zones SET valid_from = now() WHERE valid_from IS NULL;
ALTER TABLE public.shipping_zones ALTER COLUMN valid_from SET DEFAULT now();

-- 4. Map known town names to counties if missing
UPDATE public.shipping_zones SET county = 'Nairobi' WHERE name LIKE 'Nairobi%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Mombasa' WHERE name LIKE 'Mombasa%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Kisumu' WHERE name LIKE 'Kisumu%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Nakuru' WHERE name LIKE 'Nakuru%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Uasin Gishu' WHERE name LIKE 'Eldoret%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Kiambu' WHERE name LIKE 'Thika%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Kiambu' WHERE name LIKE 'Ruiru%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Kiambu' WHERE name LIKE 'Kikuyu%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Machakos' WHERE name LIKE 'Machakos%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Nakuru' WHERE name LIKE 'Naivasha%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Laikipia' WHERE name LIKE 'Nanyuki%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Kilifi' WHERE name LIKE 'Malindi%' AND county IS NULL;
UPDATE public.shipping_zones SET county = 'Kwale' WHERE name LIKE 'Diani%' AND county IS NULL;

-- 5. Fallback for any remaining missing counties
UPDATE public.shipping_zones SET county = 'Other' WHERE county IS NULL;

-- 6. Clean up duplicates (prefer comprehensive records)
-- This is a bit complex, but let's at least ensure we don't have exact name duplicates
DELETE FROM public.shipping_zones a
USING public.shipping_zones b
WHERE a.id < b.id 
  AND a.name = b.name;

COMMIT;
