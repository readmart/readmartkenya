import fs from 'fs';
import path from 'path';


const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const apiDir = path.join(rootDir, 'api');

function getAllFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(file, extensions));
    } else {
      if (extensions.some(ext => file.endsWith(ext))) {
        results.push(file);
      }
    }
  });
  return results;
}

const allSourceFiles = [...getAllFiles(srcDir, ['.ts', '.tsx']), ...getAllFiles(apiDir, ['.ts'])];
const fileContents = allSourceFiles.map(file => ({
  path: path.relative(rootDir, file).replace(/\\/g, '/'),
  content: fs.readFileSync(file, 'utf8')
}));

console.log(`Total files to check: ${allSourceFiles.length}`);

const deadFiles: string[] = [];

allSourceFiles.forEach(file => {
  const relativePath = path.relative(rootDir, file).replace(/\\/g, '/');
  const baseName = path.basename(file, path.extname(file));
  
  // Skip entry points and special files
  if (
    baseName === 'App' || 
    baseName === 'main' || 
    baseName === 'index' || 
    baseName.startsWith('_') ||
    relativePath.includes('/api/') // Keep all API files for now as they might be called externally
  ) {
    return;
  }

  // Search for the base name in all other files
  let isReferenced = false;
  for (const item of fileContents) {
    if (item.path === relativePath) continue;
    
    // Check for import or dynamic usage
    if (item.content.includes(baseName)) {
      isReferenced = true;
      break;
    }
  }

  if (!isReferenced) {
    deadFiles.push(relativePath);
  }
});

console.log('\n--- Potential Dead Code (Unreferenced Files) ---');
deadFiles.forEach(f => console.log(f));
