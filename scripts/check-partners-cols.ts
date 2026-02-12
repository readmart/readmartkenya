
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkPartners() {
  const { data, error } = await supabase.from('partners').select('*').limit(1);
  if (error) {
    console.error('Error fetching partners:', error.message);
  } else {
    console.log('Partners data sample:', data);
    if (data && data.length > 0) {
      console.log('Available columns:', Object.keys(data[0]));
    } else {
      console.log('Partners table is empty.');
      // Try to get columns by inserting an empty object and catching the error
      const { error: insertError } = await supabase.from('partners').insert({}).select();
      console.log('Insert error (might reveal columns):', insertError?.message);
    }
  }
}

checkPartners();
