
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyProductFlow() {
  console.log('--- Starting Product & Ebook Metadata Verification ---');

  const testTitle = `Test Product ${Date.now()}`;
  const testSlug = `test-product-${Date.now()}`;
  
  try {
    // 1. Create a physical product
    console.log('1. Creating physical product...');
    const { data: product, error: createError } = await supabase
      .from('products')
      .insert([{
        title: testTitle,
        slug: testSlug,
        price: 1000,
        type: 'physical',
        stock_quantity: 10,
        is_active: true
      }])
      .select()
      .single();

    if (createError) throw createError;
    console.log('✓ Product created:', product.id);

    // 2. Update product to be an ebook and add metadata
    console.log('2. Updating product to ebook and adding metadata...');
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({
        type: 'ebook',
        is_ebook: true,
        ebook_url: 'ebooks/test-file.pdf'
      })
      .eq('id', product.id)
      .select()
      .single();

    if (updateError) throw updateError;
    console.log('✓ Product updated to ebook');

    // 3. Insert ebook metadata
    const { data: metadata, error: metaError } = await supabase
      .from('ebook_metadata')
      .insert([{
        product_id: product.id,
        file_path: 'ebooks/test-file.pdf',
        format: 'pdf'
      }])
      .select()
      .single();

    if (metaError) {
      if (metaError.code === '42P01') {
        console.warn('! ebook_metadata table does not exist yet.');
      } else {
        throw metaError;
      }
    } else {
      console.log('✓ Ebook metadata created:', metadata.id);
    }

    // 4. Verify combined fetch (similar to how UI fetches)
    console.log('4. Verifying combined fetch...');
    const { data: finalProduct, error: fetchError } = await supabase
      .from('products')
      .select(`
        *,
        ebook_metadata (*)
      `)
      .eq('id', product.id)
      .single();

    if (fetchError) throw fetchError;
    console.log('✓ Combined fetch successful');
    console.log('  Type:', finalProduct.type);
    console.log('  Ebook URL:', finalProduct.ebook_url);
    console.log('  Metadata count:', finalProduct.ebook_metadata?.length || 0);

    // 5. Cleanup
    console.log('5. Cleaning up test data...');
    await supabase.from('products').delete().eq('id', product.id);
    console.log('✓ Cleanup complete');

    console.log('\n--- Verification Successful! ---');
  } catch (error: any) {
    console.error('\n--- Verification Failed ---');
    console.error('Error:', error.message || error);
    process.exit(1);
  }
}

verifyProductFlow();
