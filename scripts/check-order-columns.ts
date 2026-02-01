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

async function checkOrderColumns() {
  console.log('Testing orders table...');
  const { data, error } = await supabase.from('orders').select('*').limit(1);
  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('Columns:', Object.keys(data[0] || {}));
  }
}

checkOrderColumns();
