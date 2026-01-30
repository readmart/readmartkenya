import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const AVAILABLE_IMAGES = [
  '/assets/books/20240923044324.jpg',
  '/assets/books/20240923044800.jpg',
  '/assets/books/20240923045030.jpg',
  '/assets/books/20240923045216.jpg',
  '/assets/books/20240923045459.jpg',
  '/assets/books/20240923045805.jpg',
  '/assets/books/20240923050011.jpg',
  '/assets/books/20240923050459.jpg',
  '/assets/books/20240923050752.jpg',
  '/assets/books/20240923051047.jpg',
  '/assets/books/20240923051248.jpg',
  '/assets/books/20240923051614.jpg',
];

async function fixAssets() {
  console.log('--- Fixing Missing Product Images ---');
  
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, title, image_url, is_active');

  if (prodErr) {
    console.error('Error fetching products:', prodErr);
    return;
  }

  console.log(`Found ${products.length} products total.`);

  let fixCount = 0;
  for (const product of products) {
    let needsFix = false;
    if (!product.image_url) {
      needsFix = true;
    } else if (!product.image_url.startsWith('http')) {
      const filePath = path.join(process.cwd(), 'public', product.image_url.startsWith('/') ? product.image_url.substring(1) : product.image_url);
      if (!fs.existsSync(filePath)) {
        needsFix = true;
      }
    }

    if (needsFix) {
      const randomImage = AVAILABLE_IMAGES[Math.floor(Math.random() * AVAILABLE_IMAGES.length)];
      const { error: updateErr } = await supabase
        .from('products')
        .update({ image_url: randomImage })
        .eq('id', product.id);
      
      if (updateErr) {
        console.error(`Failed to update product ${product.title}:`, updateErr);
      } else {
        fixCount++;
      }
    }
  }

  console.log(`Fixed ${fixCount} products with missing images.`);

  console.log('\n--- Populating CMS Content ---');
  
  // Clear existing items to avoid duplicates during audit/fix
  await supabase.from('cms_content').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('Seeding CMS content...');
  const seedData = [
    {
      type: 'book_club',
      title: 'The Classics Club',
      content: 'Exploring timeless literature from around the world.',
      image_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794',
      metadata: { tier: 'basic' }
    },
    {
      type: 'book_club',
      title: 'Tech Visionaries',
      content: 'Discussing the future of technology and society.',
      image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
      metadata: { tier: 'premium' }
    },
    {
      type: 'hero',
      title: 'EVERY PAGE TELLS A STORY',
      content: 'Discover our curated collection of literature, art, and community events.',
      image_url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66',
      is_active: true
    },
    {
      type: 'banner',
      title: 'NEW ARRIVALS',
      content: 'Check out the latest additions to our collection.',
      image_url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f',
      link_url: '/shop',
      is_active: true
    },
    {
      type: 'banner',
      title: 'ARTISAN COLLECTION',
      content: 'Beautifully crafted bookmarks and book accessories.',
      image_url: 'https://images.unsplash.com/photo-1589998059171-988d887df646',
      link_url: '/shop?category=Accessories',
      is_active: true
    }
  ];

  const { error: seedErr } = await supabase
    .from('cms_content')
    .insert(seedData);

  if (seedErr) {
    console.error('Error seeding CMS content:', seedErr);
  } else {
    console.log('Successfully seeded CMS content.');
  }
}

fixAssets();
