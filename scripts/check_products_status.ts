import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
  console.log('--- Checking Categories ---');
  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('*');
  
  if (catErr) {
    console.error('Error fetching categories:', catErr);
  } else {
    console.log(`Total categories: ${categories?.length || 0}`);
    categories?.forEach(c => console.log(`- ${c.name} (${c.id})`));
  }

  console.log('\n--- Checking Products ---');
  const { data: allProducts, error: allErr } = await supabase
    .from('products')
    .select('id, title, is_active, image_url, category_id, price');

  if (allErr) {
    console.error('Error fetching all products:', allErr);
  } else {
    console.log(`Total products in DB: ${allProducts?.length || 0}`);
    const active = allProducts?.filter(p => p.is_active) || [];
    console.log(`Active products: ${active.length}`);
    const inactive = allProducts?.filter(p => !p.is_active) || [];
    console.log(`Inactive products: ${inactive.length}`);
    
    if (active.length > 0) {
      console.log('\n--- Image URLs check ---');
      const urls = active.map(p => p.image_url);
      const uniqueUrls = [...new Set(urls)];
      console.log(`Unique image URLs: ${uniqueUrls.length}`);
      uniqueUrls.forEach(url => {
        if (url && !url.startsWith('http')) {
          const filePath = path.join(process.cwd(), 'public', url.startsWith('/') ? url.substring(1) : url);
          const exists = fs.existsSync(filePath);
          console.log(`- URL: ${url} | Exists: ${exists ? 'YES' : 'NO'}`);
        } else {
          console.log(`- URL: ${url} (External or Empty)`);
        }
      });
    }
  }

  console.log('\n--- Checking Active Products (as seen by Home.tsx) ---');
  const { data: activeProducts, error: activeErr } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .limit(4);
  
  if (activeErr) {
    console.error('Error fetching active products:', activeErr);
  } else {
    console.log(`Found ${activeProducts?.length || 0} active products for homepage`);
    activeProducts?.forEach(p => console.log(`- ${p.title} (${p.id})`));
  }

  console.log('\n--- Checking CMS Content ---');
  const { data: cms, error: cmsErr } = await supabase
    .from('cms_content')
    .select('*');
  
  if (cmsErr) {
    console.error('Error fetching CMS content:', cmsErr);
  } else {
    console.log(`Total CMS items: ${cms?.length || 0}`);
    cms?.forEach(item => console.log(`- [${item.type}] ${item.title || item.name || 'Untitled'} (Active: ${item.is_active})`));
  }
}

checkProducts();
