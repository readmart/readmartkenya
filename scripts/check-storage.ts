
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Need service role to check buckets/policies

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing from .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStorage() {
  console.log('--- Checking Storage Configuration ---');
  
  // 1. Check Buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.error('Error listing buckets:', bucketsError.message);
    return;
  }
  
  console.log('Buckets found:', buckets.map(b => `${b.name} (${b.public ? 'public' : 'private'})`).join(', '));
  
  const requiredBuckets = [
    { name: 'products', public: true },
    { name: 'ebooks', public: false },
    { name: 'partnership_documents', public: false },
    { name: 'site_assets', public: true },
    { name: 'banners', public: true },
    { name: 'agreements', public: false },
    { name: 'signed_agreements', public: false }
  ];

  for (const req of requiredBuckets) {
    const bucket = buckets.find(b => b.name === req.name);
    if (!bucket) {
      console.log(`Creating missing bucket: "${req.name}" (${req.public ? 'public' : 'private'})`);
      const { error: createError } = await supabase.storage.createBucket(req.name, {
        public: req.public
      });
      if (createError) {
        console.error(`Failed to create bucket "${req.name}":`, createError.message);
      } else {
        console.log(`OK: Bucket "${req.name}" created successfully.`);
      }
    } else {
      console.log(`OK: Bucket "${req.name}" already exists.`);
    }
  }

  // 2. Check for some ebook files
  const { data: files, error: filesError } = await supabase.storage.from('ebooks').list();
  if (filesError) {
    console.error('Error listing ebooks:', filesError.message);
  } else {
    console.log(`Found ${files.length} files in ebooks bucket.`);
  }

  // 3. Test a small upload to ebooks bucket
  const testFileName = `test_upload_${Date.now()}.pdf`;
  const testContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('ebooks')
    .upload(testFileName, testContent, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    console.error('Test upload to ebooks failed:', uploadError.message);
  } else {
    console.log('Test upload to ebooks succeeded:', uploadData.path);
    
    // Cleanup
    await supabase.storage.from('ebooks').remove([testFileName]);
    console.log('Test file removed.');
  }
}

checkStorage();
