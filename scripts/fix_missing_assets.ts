
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAssets() {
  console.log('\n--- Checking Products ---');
  const { data: products, error } = await supabase
    .from('products')
    .select('id, title, image_url');

  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  const defaultImage = 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800';
  let fixCount = 0;

  for (const product of products || []) {
    if (!product.image_url || product.image_url.includes('example.com')) {
      const { error: updateErr } = await supabase
        .from('products')
        .update({ image_url: defaultImage })
        .eq('id', product.id);

      if (!updateErr) {
        fixCount++;
        console.log(`Fixed image for: ${product.title}`);
      }
    }
  }

  console.log(`Fixed ${fixCount} products with missing images.`);

  console.log('\n--- Populating CMS Tables ---');
  
  // 1. Seed Book Clubs
  console.log('Seeding Book Clubs...');
  const clubsData = [
    {
      name: 'The Classics Club',
      description: 'Exploring timeless literature from around the world.',
      image_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794',
      metadata: { tier: 'basic' }
    },
    {
      name: 'Tech Visionaries',
      description: 'Discussing the future of technology and society.',
      image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
      metadata: { tier: 'premium' }
    }
  ];

  const { error: clubsErr } = await supabase.from('book_clubs').upsert(clubsData, { onConflict: 'name' });
  if (clubsErr) console.error('Error seeding Book Clubs:', clubsErr);
  else console.log('Successfully seeded Book Clubs.');

  // 2. Seed Banners
  console.log('Seeding Banners...');
  const bannersData = [
    {
      title: 'EVERY PAGE TELLS A STORY',
      content: 'Discover our curated collection of literature, art, and community events.',
      image_url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66',
      is_active: true,
      metadata: { button_text: 'Shop Now' }
    },
    {
      title: 'NEW ARRIVALS',
      content: 'Check out the latest additions to our collection.',
      image_url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f',
      link_url: '/shop',
      is_active: true
    }
  ];

  const { error: bannersErr } = await supabase.from('banners').upsert(bannersData, { onConflict: 'title' });
  if (bannersErr) console.error('Error seeding Banners:', bannersErr);
  else console.log('Successfully seeded Banners.');

  // 3. Seed Announcements
  console.log('Seeding Announcements...');
  const announcementsData = [
    {
      title: 'Platform Launch',
      content: 'Welcome to the new ReadMart platform! Enjoy a seamless literary experience.',
      is_active: true
    }
  ];

  const { error: annErr } = await supabase.from('announcements').upsert(announcementsData, { onConflict: 'title' });
  if (annErr) console.error('Error seeding Announcements:', annErr);
  else console.log('Successfully seeded Announcements.');
}

fixAssets();
