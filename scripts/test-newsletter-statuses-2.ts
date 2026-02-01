
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

async function testInsert() {
  const statuses = ['inactive', 'unsubscribed', 'bounced'];
  for (const status of statuses) {
    console.log(`Trying status: ${status}`);
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .insert([{ email: `test-${status}@example.com`, status }]);
    
    if (error) {
      console.error(`Status ${status} failed:`, error.message);
    } else {
      console.log(`Status ${status} succeeded!`);
    }
  }
}

testInsert();
