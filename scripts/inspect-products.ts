
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error('❌ Missing or invalid SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectProductsTable() {
  console.log(`🔍 Inspecting table "products" at ${supabaseUrl}...`);

  // 1. Check if table exists
  const { error: tableError } = await supabase
    .from('products')
    .select('count')
    .limit(0);

  if (tableError) {
    console.error(`❌ Error selecting from "products":`, tableError.message);
  } else {
    console.log(`✅ Table "products" exists.`);
  }

  // 2. Inspect columns via information_schema
  console.log('📋 Fetching columns from information_schema...');
  const { data: columns, error: colError } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'products'
      ORDER BY ordinal_position;
    `
  });

  if (colError) {
    console.log('⚠️ Could not run exec_sql RPC. Trying direct query...');
    // Fallback: try to select one row and see keys
    const { data: sample, error: sampleError } = await supabase.from('products').select('*').limit(1).maybeSingle();
    if (sampleError) {
      console.error('❌ Could not fetch sample row:', sampleError.message);
    } else if (sample) {
      console.log('✅ Columns found in sample row:', Object.keys(sample));
    } else {
      console.log('⚠️ Table is empty, cannot determine columns via sample.');
    }
  } else {
    console.log('✅ Columns found:');
    console.table(columns);
  }

  // 4. Test "name" column selection
  console.log('🧪 Testing "name" column selection...');
  const { error: nameError } = await supabase.from('products').select('name').limit(1);
  if (nameError) {
    console.log('❌ "name" column is NOT selectable (or does not exist):', nameError.message);
  } else {
    console.log('✅ "name" column IS selectable.');
  }

  // 5. Test "is_published" column selection
  console.log('🧪 Testing "is_published" column selection...');
  const { error: pubError } = await supabase.from('products').select('is_published').limit(1);
  if (pubError) {
    console.log('❌ "is_published" column is NOT selectable:', pubError.message);
  } else {
    console.log('✅ "is_published" column IS selectable.');
  }
}

inspectProductsTable();
