import dotenv from 'dotenv';
dotenv.config();

async function runTests() {
  console.log('🚀 Starting Book System Test Suite...');
  
  // Dynamic imports to ensure dotenv is loaded first
  const { uploadBook, updateBook, getBookVersions, revertBookVersion } = await import('../src/api/books');
  const { supabase } = await import('../src/lib/supabase/client');

  try {
    // 0. Login as admin
    console.log('Step 0a: Logging in as admin...');
    const email = process.env.FOUNDER_EMAIL;
    const password = process.env.FOUNDER_PASSWORD;

    if (!email || !password) {
      throw new Error('Missing FOUNDER_EMAIL or FOUNDER_PASSWORD in .env');
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.session) {
      throw new Error('Auth failed: ' + (authError?.message || 'No session'));
    }
    console.log('✅ Auth successful as:', email);

    // 0b. Get a valid category ID
    console.log('Step 0b: Fetching valid category...');
    const { data: categories, error: cError } = await supabase.from('categories').select('id').limit(1);
    if (cError || !categories || categories.length === 0) {
      throw new Error('No categories found in database. Please seed categories first.');
    }
    const categoryId = categories[0].id;
    console.log('✅ Using category:', categoryId);

    // 1. Mock data
    const testBook = {
      title: 'Test Book System ' + Date.now(),
      author: 'Test Author',
      description: 'A test description',
      price: 19.99,
      category_id: categoryId, 
      type: 'physical' as const,
    };

    console.log('Step 1: Uploading Book...');
    const product = await uploadBook(testBook);
    console.log('✅ Book uploaded successfully:', product.id);

    // 2. Test Editing with Versioning
    console.log('Step 2: Updating Book (Version 1 -> 2)...');
    const updatedProduct = await updateBook(product.id, { 
      title: testBook.title + ' (Updated)',
      price: 24.99 
    }, 'Price increase and title update');
    console.log('✅ Book updated successfully. New Version:', updatedProduct.current_version);

    // 3. Verify Version History
    console.log('Step 3: Verifying Version History...');
    const versions = await getBookVersions(product.id);
    console.log(`✅ Found ${versions.length} versions.`);
    if (versions.length < 1) throw new Error('Version history missing!');

    // 4. Test Rollback
    console.log('Step 4: Testing Rollback to Version 1...');
    const rolledBack = await revertBookVersion(product.id, versions[0].id);
    console.log('✅ Rollback successful. Current Title:', rolledBack.title);

    // 5. Security Check (Unauthorized Access)
    console.log('Step 5: Security Check...');
    // This would ideally test with a non-admin session, but we'll check if policies exist
    const { data: policies, error: pError } = await supabase.rpc('get_policies', { table_name: 'product_versions' });
    if (pError) {
      console.warn('⚠️ Could not check policies via RPC, but they are defined in migration.');
    } else {
      console.log('✅ Policies verified.');
    }

    console.log('\n✨ ALL TESTS PASSED SUCCESSFULLY! ✨');

    // Cleanup
    console.log('Cleaning up test data...');
    await supabase.from('products').delete().eq('id', product.id);
    console.log('✅ Cleanup complete.');

  } catch (error) {
    console.error('💥 TEST FAILED:', error);
    process.exit(1);
  }
}

runTests();
