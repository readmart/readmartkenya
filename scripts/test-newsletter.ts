import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testNewsletterFlow() {
  const testEmail = `test-${Date.now()}@example.com`;
  console.log(`🚀 Starting Newsletter E2E Test for: ${testEmail}`);

  try {
    // 1. Simulate Subscription Request
    console.log('Step 1: Requesting subscription...');
    const subscribeRes = await fetch('http://localhost:3000/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    });
    
    const subscribeData = await subscribeRes.json();
    if (!subscribeRes.ok) throw new Error(`Subscription failed: ${subscribeData.error}`);
    console.log('✅ Subscription request successful:', subscribeData.message);

    // 2. Verify Database Status (Should be 'unconfirmed')
    console.log('Step 2: Verifying database status...');
    const { data: sub, error: fetchError } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .eq('email', testEmail)
      .single();

    if (fetchError || !sub) throw new Error('Subscriber not found in database');
    if (sub.status !== 'unconfirmed') throw new Error(`Expected status 'unconfirmed', got '${sub.status}'`);
    console.log('✅ Database status is correctly unconfirmed');

    // 3. Simulate Email Confirmation
    const token = sub.metadata?.confirmation_token;
    if (!token) throw new Error('No confirmation token found in metadata');
    console.log(`Step 3: Confirming subscription with token: ${token.substring(0, 10)}...`);

    const confirmRes = await fetch(`http://localhost:3000/api/newsletter?confirm=${token}`);
    if (confirmRes.status !== 200 && !confirmRes.url.includes('success')) {
       // Since it's a redirect, we check if it went to success page
       console.warn('⚠️ Confirmation might have redirected. Checking database for status update...');
    }

    // 4. Final Database Verification (Should be 'active')
    console.log('Step 4: Verifying final database status...');
    const { data: activeSub, error: finalError } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .eq('email', testEmail)
      .single();

    if (finalError || !activeSub) throw new Error('Subscriber not found after confirmation');
    if (activeSub.status !== 'active') throw new Error(`Expected status 'active', got '${activeSub.status}'`);
    console.log('✅ Database status is correctly active!');

    // 5. Cleanup
    console.log('Step 5: Cleaning up test data...');
    await supabase.from('newsletter_subscriptions').delete().eq('email', testEmail);
    console.log('✅ Cleanup complete.');

    console.log('🎊 Newsletter E2E Test Passed Successfully!');
  } catch (error: any) {
    console.error('❌ Test Failed:', error.message);
    process.exit(1);
  }
}

testNewsletterFlow();
