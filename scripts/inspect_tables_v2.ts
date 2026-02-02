
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable(tableName: string) {
  console.log(`\n--- Inspecting table: ${tableName} ---`);
  
  // Try a dummy insert with an empty object to trigger a schema error
  const { error: insertError } = await supabase
    .from(tableName)
    .insert([{}])
    .select()
    .single();

  if (insertError) {
    console.log(`ℹ️ Schema Info via Error:`, insertError.message);
    // If we get a "column does not exist" or "null value violates not-null" error,
    // it will give us hints about the schema.
  }

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  
  if (error) {
    console.log(`❌ Error:`, error.message);
  } else if (data && data.length > 0) {
    console.log(`✅ Columns found:`, Object.keys(data[0]));
  } else {
    console.log(`ℹ️ Table is empty.`);
  }
}

async function run() {
  const tables = ['promos', 'book_club_memberships', 'audit_logs'];
  for (const table of tables) {
    await inspectTable(table);
  }
}

run();



