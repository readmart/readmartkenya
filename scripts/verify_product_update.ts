
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyProductUpdate() {
  console.log('--- Verifying Product Description Updates ---');

  // 1. Get a sample product
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('id, title, description')
    .limit(1)
    .single();

  if (fetchError || !product) {
    console.error('❌ Failed to fetch sample product:', fetchError?.message);
    return;
  }

  console.log(`Original Product: ${product.title}`);
  const originalDescription = product.description || '';
  const testDescription = `Updated Description - Verified at ${new Date().toISOString()}`;

  // 2. Update description
  console.log(`Updating description for ID: ${product.id}...`);
  const { error: updateError } = await supabase
    .from('products')
    .update({ description: testDescription })
    .eq('id', product.id);

  if (updateError) {
    console.error('❌ Update failed:', updateError.message);
    return;
  }

  // 3. Verify update
  const { data: updatedProduct, error: verifyError } = await supabase
    .from('products')
    .select('description')
    .eq('id', product.id)
    .single();

  if (verifyError || updatedProduct.description !== testDescription) {
    console.error('❌ Verification failed. Description mismatch.');
  } else {
    console.log('✅ Product description updated and verified successfully!');
    
    // Optional: Revert change
    await supabase.from('products').update({ description: originalDescription }).eq('id', product.id);
    console.log('✅ Description reverted to original.');
  }
}

verifyProductUpdate();
