import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey.includes('placeholder')) {
  console.error('CRITICAL: Supabase environment variables are missing or invalid.');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? (supabaseServiceKey.includes('placeholder') ? 'Placeholder' : 'Set') : 'Missing');
}

// Native Supabase Client with service role for administrative actions
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const checkDbConfig = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
};
