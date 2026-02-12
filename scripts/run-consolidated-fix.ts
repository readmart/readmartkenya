
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error('❌ Missing or invalid SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runFix() {
  console.log('🚀 Starting consolidated schema fix...');

  const sqlPath = path.resolve(process.cwd(), 'supabase/migrations/20260302000002_consolidated_schema_fix.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('📡 Executing SQL via RPC...');
  
  // Try to use the exec_sql RPC if it exists
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error('❌ Fix failed:', error.message);
    if (error.message.includes('function "exec_sql" does not exist')) {
      console.log('\n💡 The "exec_sql" RPC is not installed in your database.');
      console.log('Please copy the content of the following file and run it in the Supabase SQL Editor:');
      console.log(`📂 ${sqlPath}`);
    }
  } else {
    console.log('✅ Fix applied successfully!');
    console.log('PostgREST schema cache reloaded.');
  }
}

runFix();
