-- ==========================================
-- Migration: Seed Partnership Services
-- Description: Populates the partnership_services table with default platform, logistics, and author services.
-- ==========================================

BEGIN;

INSERT INTO public.partnership_services (name, description, commission_rate, fixed_fee, is_active)
VALUES 
  (
    'ReadMart Platform', 
    'Core platform service fee for processing orders and managing the marketplace.', 
    10.00, 
    0.00, 
    true
  ),
  (
    'Logistics & Fulfillment', 
    'Third-party shipping and delivery services.', 
    0.00, 
    0.00, 
    true
  ),
  (
    'Author Royalty', 
    'Standard royalty payment for book authors.', 
    70.00, 
    0.00, 
    true
  )
ON CONFLICT DO NOTHING;

COMMIT;
