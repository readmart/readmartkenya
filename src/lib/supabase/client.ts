import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://uswmcrprlpwiazngcnjq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd21jcnBybHB3aWF6bmdjbmpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIyMTg0NiwiZXhwIjoyMDgzNzk3ODQ2fQ.yLn4cVvW5OTemsYRpyxM3G3n4Ns7CxLZHtFMbkyA5ic';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials missing from environment, using hardcoded fallbacks.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
