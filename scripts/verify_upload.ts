
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStorageUpload() {
  console.log('--- Verifying Image Upload to Storage ---');

  const testFileName = `test-upload-${Date.now()}.jpg`;
  const testContent = Buffer.from('fake-image-content'); // In reality this would be image bytes

  console.log(`Uploading test file: ${testFileName} to 'products' bucket...`);
  
  const { data, error } = await supabase.storage
    .from('products')
    .upload(testFileName, testContent, {
      contentType: 'image/jpeg',
      upsert: true
    });

  if (error) {
    console.error('❌ Upload failed:', error.message);
    return;
  }

  console.log(`✅ Upload successful! Path: ${data.path}`);

  // Verify retrieval
  const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(testFileName);
  console.log(`✅ Public URL generated: ${publicUrl}`);

  // Cleanup
  console.log('Cleaning up test file...');
  const { error: deleteError } = await supabase.storage.from('products').remove([testFileName]);
  
  if (deleteError) {
    console.warn('⚠️ Cleanup failed:', deleteError.message);
  } else {
    console.log('✅ Cleanup successful.');
  }
}

verifyStorageUpload();
