
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const email = process.env.FOUNDER_EMAIL!;
const password = process.env.FOUNDER_PASSWORD!;

async function verifyAuth() {
  console.log('--- Verifying Supabase Authentication ---');
  console.log(`Attempting login for: ${email}`);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('❌ Login Failed:', error.message);
    process.exit(1);
  }

  console.log('✅ Login Successful!');
  console.log(`User ID: ${data.user.id}`);
  console.log(`Session Access Token: ${data.session.access_token.substring(0, 20)}...`);

  // Verify session persistence/retrieval
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.error('❌ Session verification failed:', userError?.message);
    process.exit(1);
  }

  console.log('✅ Session verified. User is active.');
  
  // Sign out
  await supabase.auth.signOut();
  console.log('✅ Signed out successfully.');
}

verifyAuth();
