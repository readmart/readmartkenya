
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'YOUR_SERVICE_ROLE_KEY_HERE') {
  console.error('❌ Missing or invalid SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedPartnerships() {
  console.log('🚀 Seeding Partnerships...');

  // 0. Ensure we have users to link partners to
  console.log('👤 Ensuring partner users exist...');
  
  async function getOrCreateUser(email: string) {
    const { data: users } = await supabase.auth.admin.listUsers();
    let user = users?.users.find(u => u.email === email);

    if (!user) {
      console.log(`Creating user ${email}...`);
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true,
        user_metadata: { role: 'partner' }
      });
      if (createError) throw createError;
      user = newUser.user;
    }
    return user;
  }

  const partner1User = await getOrCreateUser('partner1@readmart.com');
  const partner2User = await getOrCreateUser('partner2@readmart.com');

  console.log(`✅ Using user IDs: ${partner1User.id}, ${partner2User.id}`);

  // 1. Seed Tiers
  const tiers = [
    { name: 'Bronze', description: 'Entry level partnership', benefits: ['Networking', 'Logo on site'] },
    { name: 'Silver', description: 'Growth partnership', benefits: ['Priority support', 'Social media mention'] },
    { name: 'Gold', description: 'Premium partnership', benefits: ['Full collaboration', 'Exclusive events'] }
  ];

  const { data: seededTiers, error: tierError } = await supabase
    .from('partnership_tiers')
    .upsert(tiers, { onConflict: 'name' })
    .select();

  if (tierError) {
    console.error('❌ Error seeding tiers:', tierError.message);
    return;
  }
  console.log(`✅ Seeded ${seededTiers.length} partnership tiers.`);

  // 2. Seed Partners
  const partnersData = [
    {
      company_name: 'Kenya Publishers Association',
      description: 'The leading umbrella body for publishers in Kenya.',
      category: 'Publishing',
      website_url: 'https://kenyapublishers.org',
      status: 'active',
      tier_id: seededTiers[2].id, // Gold
      user_id: partner1User.id
    },
    {
      company_name: 'Logistics Pro Kenya',
      description: 'Reliable logistics and delivery partner across East Africa.',
      category: 'Logistics',
      website_url: 'https://logisticspro.ke',
      status: 'active',
      tier_id: seededTiers[1].id, // Silver
      user_id: partner2User.id
    }
  ];

  // Attempt to seed partners with fallback for missing columns
  async function attemptPartnerSeed(data: any[]) {
    // Check if we already have partners to avoid duplicates if we can't use upsert
    const { data: existingPartners } = await supabase.from('partners').select('company_name');
    const existingNames = existingPartners?.map(p => p.company_name) || [];
    
    const filteredData = data.filter(p => !existingNames.includes(p.company_name));
    
    if (filteredData.length === 0) {
      console.log('ℹ️ No new partners to seed.');
      return true;
    }

    const { error } = await supabase
      .from('partners')
      .insert(filteredData);

    if (error) {
      console.log('Original error message:', error.message);
      if (error.message.includes("column") && (error.message.includes("not found") || error.message.includes("Could not find"))) {
        // Identify which column is missing from the error message
        // Matches: Could not find the 'category' column
        // Matches: column "category" not found
        const match = error.message.match(/column ['"](.*?)['"]/) || error.message.match(/['"](.*?)['"] column/);
        if (match && match[1]) {
          const missingCol = match[1];
          console.warn(`⚠️ Column '${missingCol}' not found in 'partners' table, retrying without it...`);
          const newData = data.map(item => {
            const newItem = { ...item };
            delete newItem[missingCol];
            return newItem;
          });
          return attemptPartnerSeed(newData);
        }
      }
      throw error;
    }
    return true;
  }

  try {
    await attemptPartnerSeed(partnersData);
    console.log('✅ Successfully seeded partners.');
  } catch (err: any) {
    console.error('❌ Error seeding partners:', err.message);
  }
}

seedPartnerships();
