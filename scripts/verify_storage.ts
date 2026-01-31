
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyStorage() {
  console.log('--- Auditing Supabase Storage ---');

  // 1. List buckets
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error('Error listing buckets:', bucketError);
    return;
  }

  console.log(`Found ${buckets.length} buckets:`, buckets.map(b => b.name).join(', '));

  for (const bucket of buckets) {
    console.log(`\nInspecting bucket: ${bucket.name} (Public: ${bucket.public})`);
    
    // 2. Try to list files in the root of the bucket
    const { data: files, error: fileError } = await supabase.storage.from(bucket.name).list('', {
      limit: 5,
      offset: 0,
      sortBy: { column: 'name', order: 'desc' }
    });

    if (fileError) {
      console.error(`Error listing files in ${bucket.name}:`, fileError.message);
    } else {
      console.log(`Files in ${bucket.name}:`, files.map(f => f.name).join(', ') || 'Empty');
      
      // 3. If there are files, try to get a public URL for the first one and check its accessibility
      if (files.length > 0) {
        const firstFile = files[0];
        const { data: { publicUrl } } = supabase.storage.from(bucket.name).getPublicUrl(firstFile.name);
        console.log(`Sample Public URL: ${publicUrl}`);
        
        try {
          const response = await fetch(publicUrl, { method: 'HEAD' });
          console.log(`Public access check for ${firstFile.name}: ${response.ok ? 'OK' : 'FAILED'} (Status: ${response.status})`);
        } catch (e) {
          console.log(`Public access check for ${firstFile.name}: ERROR (${e instanceof Error ? e.message : String(e)})`);
        }
      }
    }
  }

  // 4. Test upload/delete (if we have service role key, but here we use anon key which might fail if not permitted)
  console.log('\n--- Testing Write Access (with Anon Key) ---');
  const testFileName = `test-connection-${Date.now()}.txt`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('products') // Assuming products bucket exists
    .upload(testFileName, 'Hello World', {
      contentType: 'text/plain',
      upsert: true
    });

  if (uploadError) {
    console.log(`Upload test (Expected if RLS is strict): ${uploadError.message}`);
  } else {
    console.log(`Upload test: SUCCESS (${uploadData.path})`);
    // Cleanup
    const { error: deleteError } = await supabase.storage.from('products').remove([testFileName]);
    console.log(`Cleanup test: ${deleteError ? 'FAILED' : 'SUCCESS'}`);
  }
}

verifyStorage();
