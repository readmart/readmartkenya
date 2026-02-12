
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateShipping() {
  console.log('🚀 Populating shipping zones...');

  const zones = [
    { name: 'Nairobi CBD', rate: 250, is_active: true },
    { name: 'Westlands', rate: 300, is_active: true },
    { name: 'Kilimani', rate: 300, is_active: true },
    { name: 'Karen', rate: 450, is_active: true },
    { name: 'Mombasa CBD', rate: 500, is_active: true },
    { name: 'Kisumu CBD', rate: 500, is_active: true },
    { name: 'Nakuru CBD', rate: 450, is_active: true },
    { name: 'Thika CBD', rate: 400, is_active: true }
  ];

  const { error } = await supabase
    .from('shipping_zones')
    .insert(zones);

  if (error) {
    console.error('❌ Error populating shipping zones:', error);
  } else {
    console.log('✅ Successfully populated shipping zones.');
    
    const { data: fetched } = await supabase
        .from('shipping_zones')
        .select('*');
    
    if (fetched && fetched.length > 0) {
        console.log(`Fetched ${fetched.length} zones.`);
        console.log('Sample zone:', fetched[0]);
    }
  }
}

populateShipping();
