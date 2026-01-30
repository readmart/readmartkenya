import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const apiDir = path.join(rootDir, 'api');

function getAllFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
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

const allFiles = [...getAllFiles(srcDir, ['.ts', '.tsx']), ...getAllFiles(apiDir, ['.ts'])];
const graph: Record<string, string[]> = {};

allFiles.forEach(file => {
  const relativePath = path.relative(rootDir, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');
  const imports: string[] = [];
  
  // Basic regex for imports
  const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    let importPath = match[1];
    if (importPath.startsWith('@/')) {
      importPath = importPath.replace('@/', 'src/');
    } else if (importPath.startsWith('.')) {
      const dir = path.dirname(relativePath);
      importPath = path.posix.join(dir, importPath);
    }
    imports.push(importPath);
  }
  
  graph[relativePath] = imports;
});

const outputPath = path.join(rootDir, 'dependency_graph.json');
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));
console.log(`Dependency graph written to ${outputPath}`);
