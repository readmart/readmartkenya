
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPublicAccess() {
  console.log('--- Checking Public Access to Products ---');
  const { data, error, status } = await supabase
    .from('products')
    .select('id, title, is_active, image_url')
    .eq('is_active', true)
    .limit(5);

  if (error) {
    console.error('Error fetching products as public user:', error);
    console.log('Status code:', status);
  } else {
    console.log(`Successfully fetched ${data?.length || 0} products as public user.`);
    data?.forEach(p => {
      console.log(`- ${p.title} (ID: ${p.id}) | Image: ${p.image_url || p.image || 'NONE'}`);
    });
  }

  console.log('\n--- Checking Categories ---');
  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .select('id, name');
  
  if (catErr) {
    console.error('Error fetching categories as public user:', catErr);
  } else {
    console.log(`Successfully fetched ${cats?.length || 0} categories.`);
  }
}

checkPublicAccess();
