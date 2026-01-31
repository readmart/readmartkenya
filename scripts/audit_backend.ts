
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStorageAndJoin() {
  console.log('--- Comprehensive Backend Audit: Storage & Joins ---');

  // 1. Audit Storage Buckets and Policies
  console.log('\n[1/3] Auditing Storage Buckets...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error('❌ Error listing buckets:', bucketError.message);
  } else {
    console.log(`✅ Found ${buckets.length} buckets:`, buckets.map(b => b.name).join(', '));
    for (const bucket of buckets) {
      const { data: files, error: fileError } = await supabase.storage.from(bucket.name).list('', { limit: 1 });
      console.log(`   - ${bucket.name}: ${bucket.public ? 'PUBLIC' : 'PRIVATE'} | Files: ${fileError ? 'Error (' + fileError.message + ')' : (files.length > 0 ? 'Yes' : 'Empty')}`);
    }
  }

  // 2. Verify Database Joins (Product-Category)
  console.log('\n[2/3] Verifying Database Joins (Products -> Categories)...');
  const { data: products, error: joinError } = await supabase
    .from('products')
    .select('id, title, category_id, categories(id, name)')
    .limit(3);

  if (joinError) {
    console.error('❌ Join Error:', joinError.message);
    if (joinError.message.includes('relationship')) {
      console.log('   💡 Root Cause: Missing Foreign Key relationship between products and categories.');
    }
  } else {
    console.log(`✅ Successfully fetched ${products?.length} products with joined categories.`);
    products?.forEach(p => {
      console.log(`   - Product: ${p.title} | Category: ${p.categories ? (Array.isArray(p.categories) ? p.categories[0]?.name : (p.categories as any).name) : 'NONE'}`);
    });
  }

  // 3. Verify Profile-Settings Join (Author of the Day)
  console.log('\n[3/3] Verifying Author-Settings Join...');
  const { data: settings, error: settingsError } = await supabase
    .from('site_settings')
    .select('*, author:profiles!author_of_the_day_id(id, full_name)')
    .maybeSingle();

  if (settingsError) {
    console.error('❌ Author Join Error:', settingsError.message);
  } else {
    console.log('✅ Site settings fetched successfully.');
    if (settings?.author) {
      console.log(`   - Author of the Day: ${(settings.author as any).full_name}`);
    } else {
      console.log('   - Author of the Day: Not set or profile missing.');
    }
  }

  console.log('\n--- Audit Complete ---');
}

verifyStorageAndJoin();
