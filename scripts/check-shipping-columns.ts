import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkShippingZones() {
  console.log('Testing shipping_zones table...');
  
  // 1. Try selecting all
  const { data: allData, error: allError } = await supabase
    .from('shipping_zones')
    .select('*')
    .limit(1);
    
  if (allError) {
    console.error('Error selecting *:', allError.message);
  } else {
    console.log('Successfully selected *');
    console.log('Columns found:', Object.keys(allData[0] || {}));
  }
  
  // 2. Try selecting country_code explicitly
  const { error: ccError } = await supabase
    .from('shipping_zones')
    .select('country_code')
    .limit(1);
    
  if (ccError) {
    console.error('Error selecting country_code:', ccError.message);
  } else {
    console.log('Successfully selected country_code');
  }
}

checkShippingZones();
