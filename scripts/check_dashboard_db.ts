
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking database schema...');

  const tables = [
    'newsletter_subscriptions',
    'site_settings',
    'settings',
    'profiles',
    'categories'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(0);
    if (error) {
      console.log(`❌ Table "${table}" error:`, error.message);
    } else {
      console.log(`✅ Table "${table}" exists`);
      
      // Check columns for specific tables
      if (table === 'site_settings') {
        const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'site_settings' });
        if (colError) {
          console.log(`  Checking columns for site_settings via select...`);
          const { data: sample } = await supabase.from('site_settings').select('*').limit(1).maybeSingle();
          if (sample) {
             console.log('  Columns:', Object.keys(sample));
          }
        } else {
          console.log('  Columns:', cols);
        }
      }
      
      if (table === 'profiles') {
        const { data: sample } = await supabase.from('profiles').select('*').limit(1).maybeSingle();
        if (sample) {
          console.log('  Profile columns:', Object.keys(sample));
        }
      }
    }
  }
}

checkSchema();
