import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const founderEmail = process.env.FOUNDER_EMAIL;
const founderPassword = process.env.FOUNDER_PASSWORD;
const bootstrapEnabled = process.env.BOOTSTRAP_ENABLED === 'true';

async function bootstrap() {
  if (!bootstrapEnabled) {
    console.log('Bootstrap is disabled in .env. Skipping...');
    return;
  }

  if (!supabaseUrl || !supabaseServiceKey || !founderEmail || !founderPassword) {
    console.error('Missing required environment variables for bootstrap.');
    process.exit(1);
  }

  // Use Service Role Key to bypass RLS
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log(`🚀 Starting bootstrap for ${founderEmail}...`);

  try {
    // 1. Check if founder user exists in auth.users
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) throw listError;

    let founderUser = users.find(u => u.email === founderEmail);

    if (!founderUser) {
      console.log('Creating founder auth account...');
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email: founderEmail,
        password: founderPassword,
        email_confirm: true
      });

      if (createError) throw createError;
      founderUser = user!;
      console.log('✅ Founder auth account created.');
    } else {
      console.log('ℹ️ Founder auth account already exists.');
    }

    // 2. Ensure profile exists and has 'founder' role
    // The handle_new_user trigger might have already created a profile, 
    // but we need to ensure it has the correct role.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', founderUser.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    if (!profile) {
      console.log('Creating founder profile...');
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: founderUser.id,
          full_name: 'System Founder',
          role: 'founder'
        });

      if (insertError) throw insertError;
      console.log('✅ Founder profile created.');
    } else if (profile.role !== 'founder') {
      console.log(`Updating profile role from ${profile.role} to founder...`);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'founder' })
        .eq('id', founderUser.id);

      if (updateError) throw updateError;
      console.log('✅ Founder role assigned.');
    } else {
      console.log('✅ Founder profile is already correctly configured.');
    }

    console.log('✨ Bootstrap completed successfully!');
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();
