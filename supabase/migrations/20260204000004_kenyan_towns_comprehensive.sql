-- Comprehensive seeding of Kenyan towns and shipping zones
INSERT INTO public.shipping_zones (name, country_code, region, county, postal_codes, price, weight_surcharge, volume_surcharge, estimated_days, is_active)
VALUES 
    ('Nairobi Central', 'KE', 'Nairobi', 'Nairobi', '00100, 00200, 00300', 300.00, 50.00, 100.00, 1, true),
    ('Westlands', 'KE', 'Nairobi', 'Nairobi', '00800', 350.00, 50.00, 100.00, 1, true),
    ('Karen', 'KE', 'Nairobi', 'Nairobi', '00502', 450.00, 50.00, 100.00, 1, true),
    ('Mombasa CBD', 'KE', 'Coast', 'Mombasa', '80100', 500.00, 80.00, 150.00, 2, true),
    ('Nyali', 'KE', 'Coast', 'Mombasa', '80118', 550.00, 80.00, 150.00, 2, true),
    ('Kisumu CBD', 'KE', 'Nyanza', 'Kisumu', '40100', 600.00, 100.00, 200.00, 2, true),
    ('Nakuru CBD', 'KE', 'Rift Valley', 'Nakuru', '20100', 450.00, 70.00, 120.00, 2, true),
    ('Eldoret CBD', 'KE', 'Rift Valley', 'Uasin Gishu', '30100', 550.00, 90.00, 140.00, 2, true),
    ('Thika', 'KE', 'Central', 'Kiambu', '01000', 400.00, 60.00, 110.00, 1, true),
    ('Kiambu Town', 'KE', 'Central', 'Kiambu', '00900', 350.00, 50.00, 100.00, 1, true),
    ('Machakos CBD', 'KE', 'Eastern', 'Machakos', '90100', 400.00, 60.00, 110.00, 1, true),
    ('Malindi', 'KE', 'Coast', 'Kilifi', '80200', 650.00, 100.00, 180.00, 3, true),
    ('Lamu', 'KE', 'Coast', 'Lamu', '80500', 800.00, 150.00, 250.00, 4, true),
    ('Kitale', 'KE', 'Rift Valley', 'Trans Nzoia', '30200', 600.00, 100.00, 160.00, 3, true),
    ('Kakamega', 'KE', 'Western', 'Kakamega', '50100', 600.00, 100.00, 160.00, 3, true),
    ('Nyeri', 'KE', 'Central', 'Nyeri', '10100', 450.00, 70.00, 120.00, 2, true),
    ('Garissa', 'KE', 'North Eastern', 'Garissa', '70100', 850.00, 150.00, 250.00, 4, true),
    ('Diani Beach', 'KE', 'Coast', 'Kwale', '80401', 650.00, 100.00, 180.00, 3, true),
    ('Naivasha', 'KE', 'Rift Valley', 'Nakuru', '20117', 400.00, 60.00, 110.00, 2, true),
    ('Kericho', 'KE', 'Rift Valley', 'Kericho', '20200', 550.00, 80.00, 140.00, 2, true)
ON CONFLICT (name) DO UPDATE SET 
    country_code = EXCLUDED.country_code,
    region = EXCLUDED.region,
    county = EXCLUDED.county,
    postal_codes = EXCLUDED.postal_codes,
    price = EXCLUDED.price,
    weight_surcharge = EXCLUDED.weight_surcharge,
    volume_surcharge = EXCLUDED.volume_surcharge,
    estimated_days = EXCLUDED.estimated_days,
    is_active = EXCLUDED.is_active;
