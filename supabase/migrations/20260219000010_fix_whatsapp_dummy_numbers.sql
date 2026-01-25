-- Fix dummy WhatsApp numbers in site_settings
UPDATE public.site_settings 
SET 
    whatsapp_link = 'https://wa.me/254794129958',
    global_support_whatsapp = 'https://wa.me/254794129958'
WHERE 
    whatsapp_link = 'https://wa.me/254700000000' 
    OR global_support_whatsapp = 'https://wa.me/254700000000';

-- Also ensure any other settings with the dummy number are updated
UPDATE public.site_settings 
SET 
    contact_phone = '+254 794 129 958'
WHERE 
    contact_phone = '+254 700 000 000';
