
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNewsletterSchema() {
  console.log('--- Checking newsletter_subscriptions ---');
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching newsletter_subscriptions:', error);
  } else {
    console.log('Sample record:', data);
  }
}

checkNewsletterSchema();
