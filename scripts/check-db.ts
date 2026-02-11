import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';

// Check for .env.local first, then .env
const envPath = fs.existsSync(resolve(process.cwd(), '.env.local')) 
  ? resolve(process.cwd(), '.env.local') 
  : resolve(process.cwd(), '.env');

dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(`❌ Missing Supabase environment variables in ${envPath}`);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log(`🔍 Auditing ReadMart Database Integrity...`);
  console.log(`📡 Connecting to: ${supabaseUrl}\n`);
  
  const tables = [
    'profiles',
    'products',
    'categories',
    'orders',
    'order_items',
    'reviews',
    'transactions',
    'banners',
    'book_clubs',
    'announcements',
    'events',
    'shipping_zones',
    'promos',
    'payment_methods',
    'newsletter_subscriptions',
    'partnership_applications',
    'author_applications',
    'partnership_agreements',
    'agreements',
    'partnership_services',
    'partnership_tiers',
    'partners',
    'fulfillment_ledger',
    'contact_messages',
    'site_settings',
    'notification_logs'
  ];
  
  const results = await Promise.all(tables.map(async (table) => {
    try {
      if (table === 'site_settings') {
        const requiredColumns = ['site_name', 'site_logo', 'contact_email', 'whatsapp_link', 'maintenance_mode', 'secondary_phone', 'tax_rate', 'default_currency', 'hero_headline', 'hero_subtext', 'hero_image_url'];
        const missingCols = [];
        for (const col of requiredColumns) {
          const { error } = await supabase.from(table).select(col).limit(1);
          if (error && error.code === '42703') {
            missingCols.push(col);
          }
        }
        
        if (missingCols.length > 0) {
          return { 
            table, 
            status: '❌ Error', 
            details: `Missing columns: ${missingCols.join(', ')}` 
          };
        }
        
        const { data } = await supabase.from(table).select('*').limit(1);
        return { table, status: '✅ OK', details: data && data.length > 0 ? '✅ All Columns OK' : '⚠️ Table Empty' };
      }

      if (table === 'products') {
        const requiredColumns = ['sale_price', 'type', 'is_active', 'stock_quantity', 'metadata'];
        const missingCols = [];
        for (const col of requiredColumns) {
          const { error } = await supabase.from(table).select(col).limit(1);
          if (error && error.code === '42703') {
            missingCols.push(col);
          }
        }

        if (missingCols.length > 0) {
          return { 
            table, 
            status: '❌ Error', 
            details: `Missing columns: ${missingCols.join(', ')}` 
          };
        }
      }

      const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });

      if (error) {
        return { 
          table, 
          status: '❌ Error', 
          details: `[${error.code}] ${error.message}` 
        };
      }
      
      const details = `✅ ${count} rows`;

      return { table, status: '✅ OK', details };
    } catch (e) {
      return { table, status: '❌ Exception', details: String(e) };
    }
  }));

  console.table(results);

  const errors = results.filter(r => r.status.includes('❌'));
  if (errors.length > 0) {
    console.log('\n⚠️ Issues detected:');
    errors.forEach(e => console.log(`- ${e.table}: ${e.details}`));
    console.log('\n💡 Suggestions:');
    console.log('1. Check if the table exists in the Supabase Dashboard.');
    console.log('2. Verify Row Level Security (RLS) policies allow "anon" access.');
    console.log('3. If PGRST205, reload the schema cache (Settings -> API -> PostgREST).');
  } else {
    console.log('\n✅ All checked tables and columns are accessible!');
  }
}

checkDatabase();
