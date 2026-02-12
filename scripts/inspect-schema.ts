
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function inspectTables() {
  console.log('Inspecting partnership tables...');
  
  const { data: tiersCols, error: tiersError } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'partnership_tiers'" 
  });
  
  if (tiersError) {
    console.error('Error inspecting partnership_tiers:', tiersError.message);
  } else {
    console.log('partnership_tiers columns:', tiersCols);
  }

  const { data: partnersCols, error: partnersError } = await supabase.rpc('exec_sql', { 
    sql_query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'partners'" 
  });
  
  if (partnersError) {
    console.error('Error inspecting partners:', partnersError.message);
  } else {
    console.log('partners columns:', partnersCols);
  }
}

inspectTables();
