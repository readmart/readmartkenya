-- Update site settings with new contact information
insert into public.settings (
  id, 
  site_name, 
  contact_email, 
  contact_phone, 
  whatsapp_link,
  address,
  working_hours
) values (
  '00000000-0000-0000-0000-000000000000',
  'ReadMart',
  'support@readmartke.com',
  '+254 794 129 958',
  'https://wa.me/254794129958',
  'Nairobi, Kenya',
  'Mon-Fri: 8am - 5pm'
)
on conflict (id) do update set
  contact_email = excluded.contact_email,
  contact_phone = excluded.contact_phone,
  whatsapp_link = excluded.whatsapp_link,
  updated_at = now();
