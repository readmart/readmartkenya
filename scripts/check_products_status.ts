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
  console.log('\n--- Checking Tables ---');
  const { data: tables, error: tableErr } = await supabase
    .rpc('exec_sql', { sql_query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'" });
  
  if (tableErr) {
    console.error('Error fetching tables (rpc failed):', tableErr.message);
    // Fallback: try to select from them directly to see if they exist
    const checkTable = async (name: string) => {
      const { error } = await supabase.from(name).select('id').limit(1);
      console.log(`Table '${name}' exists: ${!error || error.code !== '42P01'}`);
    };
    await checkTable('banners');
    await checkTable('book_clubs');
    await checkTable('announcements');
    await checkTable('events');
    await checkTable('legacy_cms_content');
    await checkTable('book_club_members');
    await checkTable('categories');
    await checkTable('products');
  } else {
    console.log('Tables in public schema:');
    tables.forEach((t: any) => console.log(`- ${t.table_name}`));
  }

  console.log('\n--- Checking Banners Columns ---');
  const { data: bannerCols, error: bannerColErr } = await supabase
    .from('banners')
    .select('*')
    .limit(1);
  
  if (bannerColErr) {
    console.error('Error fetching banners:', bannerColErr.message);
  } else if (bannerCols && bannerCols.length > 0) {
    console.log('banners columns:', Object.keys(bannerCols[0]));
  }

  console.log('\n--- Checking Book Clubs Columns ---');
  const { data: clubsCols, error: clubsColErr } = await supabase
    .from('book_clubs')
    .select('*')
    .limit(1);
  
  if (clubsColErr) {
    console.error('Error fetching book_clubs:', clubsColErr.message);
  } else if (clubsCols && clubsCols.length > 0) {
    console.log('book_clubs columns:', Object.keys(clubsCols[0]));
  }

  console.log('\n--- Checking Book Club Members Columns ---');
  const { data: membersCols, error: membersColErr } = await supabase
    .from('book_club_members')
    .select('*')
    .limit(1);
  
  if (membersColErr) {
    console.error('Error fetching book_club_members:', membersColErr.message);
  } else if (membersCols && membersCols.length > 0) {
    console.log('book_club_members columns:', Object.keys(membersCols[0]));
  } else {
    console.log('book_club_members table is empty');
  }

  console.log('\n--- Checking Categories ---');
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
