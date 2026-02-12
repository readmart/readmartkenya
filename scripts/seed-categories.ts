import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error('❌ Missing or placeholder SUPABASE_SERVICE_ROLE_KEY in .env. Seeding categories requires service role key if RLS is enabled.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function seedCategories() {
  console.log('🚀 Seeding Categories...');

  const categories = [
    { name: 'Fiction', slug: 'fiction' },
    { name: 'Non-Fiction', slug: 'non-fiction' },
    { name: 'Art & Photography', slug: 'art-photography' },
    { name: 'Academic', slug: 'academic' },
    { name: 'Children', slug: 'children' },
    { name: 'African Literature', slug: 'african-literature' }
  ];

  const { data, error } = await supabase
    .from('categories')
    .upsert(categories, { onConflict: 'slug' })
    .select();

  if (error) {
    console.error('❌ Error seeding categories:', error);
  } else {
    console.log(`✅ Successfully seeded ${data?.length || 0} categories.`);
  }
}

seedCategories();
