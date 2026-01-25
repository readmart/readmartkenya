
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProfiles() {
  console.log('Checking profiles table...');
  
  // Try to fetch one author
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('role', 'author')
    .limit(1);

  if (error) {
    console.error('Error fetching authors:', error);
  } else {
    console.log('Successfully fetched authors:', data);
  }

  // Try to fetch roles from a profile
  const { data: roles, error: rolesError } = await supabase
    .from('profiles')
    .select('role')
    .limit(10);
  
  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
  } else {
    const uniqueRoles = [...new Set(roles.map(r => r.role))];
    console.log('Roles found in database:', uniqueRoles);
  }
}

checkProfiles();
