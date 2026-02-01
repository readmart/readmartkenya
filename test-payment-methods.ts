
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPaymentMethods() {
  console.log('Testing payment_methods table...');
  
  // 1. Try to select
  const { data: selectData, error: selectError } = await supabase
    .from('payment_methods')
    .select('*')
    .limit(1);
    
  if (selectError) {
    console.error('Select error:', selectError.message);
  } else {
    console.log('Select successful. Data:', selectData);
  }

  // 2. Try to get columns via information_schema (might fail if not admin, but let's try)
  // Actually, let's just try to insert a dummy record with a fake UUID
  const fakeUserId = '00000000-0000-0000-0000-000000000000';
  const { error: insertError } = await supabase
    .from('payment_methods')
    .insert({
      user_id: fakeUserId,
      type: 'mpesa',
      provider: 'Test',
      identifier: '0712345678'
    });
    
  if (insertError) {
    console.log('Insert failed (expected if RLS or FK fails):', insertError.message);
  } else {
    console.log('Insert successful!');
  }
}

testPaymentMethods();
