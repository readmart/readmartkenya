
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
  console.log('--- Applying missing columns to site_settings ---');
  const sql = `
    ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS author_of_the_day_id uuid REFERENCES public.profiles(id);
    ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS author_of_the_day_image text;
    ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS author_of_the_day_books uuid[] DEFAULT '{}';
    ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS author_of_the_day_enabled boolean DEFAULT false;
  `;
  
  const { error: sqlError } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (sqlError) {
    console.warn('Could not run exec_sql, trying manual alter... (Error: ' + sqlError.message + ')');
    // If exec_sql RPC doesn't exist, we might be in trouble without direct DB access
  } else {
    console.log('SQL applied successfully');
  }

  console.log('--- Verifying site_settings ---');
  const { data: settings, error: settingsError } = await supabase
    .from('site_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (settingsError) {
    console.error('Error fetching site_settings:', settingsError);
  } else {
    console.log('site_settings columns:', Object.keys(settings || {}));
  }

  console.log('\n--- Verifying profiles ---');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  if (profileError) {
    console.error('Error fetching profiles:', profileError);
  } else {
    console.log('profiles columns:', Object.keys(profile || {}));
  }

  console.log('\n--- Testing Join ---');
  const { data: joinData, error: joinError } = await supabase
    .from('site_settings')
    .select('*, author_of_the_day:profiles!author_of_the_day_id(id, full_name, avatar_url, bio)')
    .maybeSingle();

  if (joinError) {
    console.error('Join Error:', joinError);
  } else {
    console.log('Join Success!');
    console.log('Data:', JSON.stringify(joinData, null, 2));
  }
}

verify();
