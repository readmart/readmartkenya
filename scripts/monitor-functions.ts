import fs from 'fs';
import path from 'path';

const apiDir = path.join(process.cwd(), 'api');

function monitorFunctions() {
  if (!fs.existsSync(apiDir)) {
    console.error('API directory not found');
    return;
  }

  const files = fs.readdirSync(apiDir);
  const functions = files.filter(file => 
    (file.endsWith('.ts') || file.endsWith('.js')) && !file.startsWith('_')
  );

  const limit = 12;
  const count = functions.length;

  console.log(`\n--- Vercel Serverless Function Monitor ---`);
  console.log(`Current Count: ${count}`);
  console.log(`Hobby Plan Limit: ${limit}`);
  
  if (count > limit) {
    console.error(`\n❌ ERROR: You have exceeded the Vercel Hobby plan limit of ${limit} functions!`);
    console.error(`Current functions (${count}):`);
    functions.forEach(f => console.error(` - ${f}`));
    process.exit(1);
  } else if (count >= limit - 2) {
    console.warn(`\n⚠️ WARNING: You are approaching the Vercel Hobby plan limit of ${limit} functions.`);
    console.warn(`Current functions (${count}):`);
    functions.forEach(f => console.warn(` - ${f}`));
  } else {
    console.log(`\n✅ Safe: You are well within the ${limit} function limit.`);
  }
}

monitorFunctions();
