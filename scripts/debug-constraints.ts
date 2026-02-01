
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function checkConstraint() {
  console.log('Checking newsletter_subscriptions table constraints...');
  
  // We can query information_schema to see constraints
  const { data, error } = await supabase.rpc('get_table_constraints', { 
    t_name: 'newsletter_subscriptions' 
  });

  if (error) {
    console.log('RPC get_table_constraints failed, trying raw query via select...');
    // If RPC doesn't exist, we can't easily query information_schema via Supabase client
    // because it restricts access to the public schema by default.
    // However, service role might have more access if we use a specific approach.
    
    // Plan B: Just try to insert all possible statuses and see which ones fail
    const statuses = ['active', 'unconfirmed', 'unsubscribed', 'paused', 'deleted', 'pending'];
    console.log('Testing statuses by insertion:');
    
    for (const status of statuses) {
      const email = `test-constraint-${status}-${Date.now()}@example.com`;
      const { error: insertError } = await supabase
        .from('newsletter_subscriptions')
        .insert([{ email, status }]);
      
      if (insertError) {
        console.log(`❌ Status "${status}" FAILED: ${insertError.message}`);
      } else {
        console.log(`✅ Status "${status}" SUCCEEDED`);
        // Clean up
        await supabase.from('newsletter_subscriptions').delete().eq('email', email);
      }
    }
  } else {
    console.log('Constraints:', data);
  }
}

checkConstraint();
