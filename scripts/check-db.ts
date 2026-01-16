import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const tables = [
  'profiles',
  'products',
  'categories',
  'orders',
  'order_items',
  'reviews',
  'transactions',
  'audit_logs',
  'cms_content',
  'shipping_zones',
  'promos',
  'book_club_memberships',
  'author_applications',
  'partnership_applications',
  'contact_messages',
  'notification_logs',
  'fulfillment_ledger',
  'settings'
];

async function checkDatabase() {
  console.log('🔍 Auditing ReadMart Database Integrity...\n');
  
  const results = await Promise.all(tables.map(async (table) => {
    try {
      const { error } = await supabase.from(table).select('count').limit(1);
      if (error) {
        return { table, exists: false, error: error.message };
      }
      return { table, exists: true };
    } catch (e) {
      return { table, exists: false, error: String(e) };
    }
  }));

  console.table(results);

  const missing = results.filter(r => !r.exists);
  if (missing.length > 0) {
    console.log('\n⚠️  The following tables are MISSING or inaccessible:');
    missing.forEach(m => console.log(`- ${m.table}: ${m.error}`));
    console.log('\n💡 Please run the corresponding migrations in the Supabase SQL Editor.');
  } else {
    console.log('\n✅ All core tables are present and healthy!');
  }
}

checkDatabase();
