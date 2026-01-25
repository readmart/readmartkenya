
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
  console.log('Testing EXACT query from log...');
  // select=*,author_of_the_day:author_of_the_day_id(id,full_name,avatar_url,bio)
  const { data, error } = await supabase
    .from('site_settings')
    .select('*, author_of_the_day:profiles!author_of_the_day_id(id, full_name, avatar_url, bio)')
    .maybeSingle();

  if (error) {
    console.error('Query Failed!');
    console.error('Error Code:', error.code);
    console.error('Error Message:', error.message);
    console.error('Error Details:', error.details);
    console.error('Error Hint:', error.hint);
  } else {
    console.log('Query Succeeded!');
    console.log('Data:', JSON.stringify(data, null, 2));
  }
}

testQuery();
