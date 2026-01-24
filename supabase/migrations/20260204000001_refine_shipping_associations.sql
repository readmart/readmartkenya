-- ==========================================
-- Migration: Refine Shipping Zone Associations
-- Target: shipping_zones
-- Description: Populates region and postal_codes for Kenyan zones to complete metadata associations.
-- ==========================================

BEGIN;

-- 1. Populate Region from Name (Pattern: 'Region - Area' or 'Region - Town')
UPDATE public.shipping_zones
SET region = split_part(name, ' - ', 1)
WHERE country_code = 'KE' AND region IS NULL AND name LIKE '% - %';

-- 2. Populate Postal Codes for major hubs to enable auto-matching in checkout
-- Nairobi Hubs
UPDATE public.shipping_zones SET postal_codes = '00100' WHERE name = 'Nairobi - CBD';
UPDATE public.shipping_zones SET postal_codes = '00800' WHERE name = 'Nairobi - Westlands';
UPDATE public.shipping_zones SET postal_codes = '00100, 00501' WHERE name = 'Nairobi - Kilimani';
UPDATE public.shipping_zones SET postal_codes = '00502' WHERE name = 'Nairobi - Karen';
UPDATE public.shipping_zones SET postal_codes = '00509' WHERE name = 'Nairobi - Langata';
UPDATE public.shipping_zones SET postal_codes = '00100, 00600' WHERE name = 'Nairobi - Kasarani';
UPDATE public.shipping_zones SET postal_codes = '00500' WHERE name = 'Nairobi - Embakasi';

-- Mombasa Hubs
UPDATE public.shipping_zones SET postal_codes = '80100' WHERE name = 'Mombasa - Island';
UPDATE public.shipping_zones SET postal_codes = '80118' WHERE name = 'Mombasa - Nyali';

-- Other Cities
UPDATE public.shipping_zones SET postal_codes = '40100' WHERE name = 'Kisumu - Kisumu City';
UPDATE public.shipping_zones SET postal_codes = '20100' WHERE name = 'Nakuru - Nakuru City';
UPDATE public.shipping_zones SET postal_codes = '30100' WHERE name = 'Uasin Gishu - Eldoret';
UPDATE public.shipping_zones SET postal_codes = '10100' WHERE name = 'Nyeri - Nyeri Town';
UPDATE public.shipping_zones SET postal_codes = '01000' WHERE name = 'Kiambu - Thika';
UPDATE public.shipping_zones SET postal_codes = '90100' WHERE name = 'Machakos - Machakos Town';

-- 3. Ensure all zones have a default shipping method if not set
UPDATE public.shipping_zones SET shipping_method = 'Standard' WHERE shipping_method IS NULL;

COMMIT;
