
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function testBrowserQuery() {
  console.log(`📡 Testing browser query at ${supabaseUrl}...`);
  console.log(`🔑 Using Key (start): ${supabaseAnonKey?.substring(0, 20)}...`);

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Query failed:', error);
  } else {
    console.log('✅ Query succeeded!');
    console.log('Available columns:', data && data[0] ? Object.keys(data[0]) : 'No rows found');
  }
}

testBrowserQuery();
