
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// NOTE: This script needs a real service role key to query pg_policies
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkPolicies() {
  console.log(`🔍 Checking policies for "products" table...`);

  // We try to use the 'exec_sql' RPC if it exists, otherwise we can't do much without a real service key
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT tablename, policyname, roles, cmd, qual 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'products';
    `
  });

  if (error) {
    console.error('❌ Could not check policies:', error.message);
    console.log('Trying to select with anon key to see if it works without "title"...');
    
    const anonClient = createClient(supabaseUrl!, process.env.VITE_SUPABASE_ANON_KEY!);
    const { data: simple, error: simpleError } = await anonClient.from('products').select('id').limit(1);
    
    if (simpleError) {
      console.error('❌ Even selecting "id" failed for anon:', simpleError.message);
    } else {
      console.log('✅ Selecting "id" worked for anon.');
    }
  } else {
    console.table(data);
  }
}

checkPolicies();
