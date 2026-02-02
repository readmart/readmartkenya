
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkRpc() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' });
  if (error) {
    console.error('RPC exec_sql failed:', error.message);
  } else {
    console.log('RPC exec_sql exists and works!', data);
  }
}

checkRpc();
