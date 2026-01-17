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

const bookFiles = [
  '20240923044324.jpg',
  '20240923044800.jpg',
  '20240923045030.jpg',
  '20240923045216.jpg',
  '20240923045459.jpg',
  '20240923045805.jpg',
  '20240923050011.jpg',
  '20240923050459.jpg',
  '20240923050752.jpg',
  '20240923051047.jpg',
  '20240923051248.jpg',
  '20240923051614.jpg',
  'FWVC0219.JPG',
  'GDKT1300.JPG',
  'GXJR3524.JPG',
  'IMG_2311.JPG',
  'IMG_2313.JPG',
  'IMG_2356.JPG',
  'IMG_2365.JPG',
  'IMG_2366.JPG',
  'IMG_2377.JPG',
  'IMG_2420.JPG',
  'IMG_2436.JPG',
  'IMG_2443.JPG',
  'IMG_2444.JPG',
  'IMG_2465.JPG',
  'IMG_2471.JPG',
  'IMG_2474.JPG',
  'IMG_2609.JPG',
  'IMG_2847.JPG'
];

const authors = [
  'ReadMart Classics',
  'Ngugi wa Thiong\'o',
  'Chinua Achebe',
  'Chimamanda Ngozi Adichie',
  'Margaret Ogola',
  'Meja Mwangi',
  'Binyavanga Wainaina',
  'Yvonne Adhiambo Owuor'
];

async function seedBooks() {
  console.log('🚀 Starting Book Seeding Process...');

  // 1. Get categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name');

  if (catError) {
    console.error('Error fetching categories:', catError);
    return;
  }

  if (!categories || categories.length === 0) {
    console.error('No categories found. Please seed categories first.');
    return;
  }

  const artCategory = categories.find(c => c.name.includes('Art')) || categories[0];
  const generalCategory = categories.find(c => c.name.includes('Fiction') || c.name.includes('General')) || categories[0];

  console.log(`Using categories: ${artCategory.name} and ${generalCategory.name}`);

  const productsToInsert = bookFiles.map((filename, index) => {
    const isArt = filename.startsWith('IMG_') || filename.startsWith('FWVC') || filename.startsWith('GDKT') || filename.startsWith('GXJR');
    const category = isArt ? artCategory : generalCategory;
    const author = authors[index % authors.length];
    
    const title = isArt ? `Artistic Vision Vol. ${index + 1}` : `ReadMart Collection: Item ${index + 1}`;
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${index}`;
    const price = Math.floor(Math.random() * (5000 - 500 + 1)) + 500;

    return {
      title,
      slug,
      description: `A premium selection from the ReadMart ${category.name} collection. This book offers profound insights and a captivating reading experience.`,
      price,
      category_id: category.id,
      stock_quantity: Math.floor(Math.random() * 50) + 10,
      is_published: true,
      image_url: `/assets/books/${filename}`,
      metadata: {
        author,
        rating: (Math.random() * (5 - 4) + 4).toFixed(1),
        condition: 'New',
        format: 'Physical'
      }
    };
  });

  const { data, error } = await supabase
    .from('products')
    .upsert(productsToInsert, { onConflict: 'slug' })
    .select();

  if (error) {
    console.error('Error seeding books:', error);
  } else {
    console.log(`✅ Successfully seeded ${data.length} books into the database!`);
  }
}

seedBooks();
