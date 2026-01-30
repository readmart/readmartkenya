
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const apiDir = path.join(rootDir, 'api');

interface DepGraph {
  nodes: { id: string; type: 'page' | 'component' | 'api' | 'lib' | 'hook' | 'context' }[];
  links: { source: string; target: string }[];
}

const graph: DepGraph = {
  nodes: [],
  links: []
};

function walk(dir: string, callback: (file: string) => void) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walk(filepath, callback);
    } else if (stats.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
      callback(filepath);
    }
  });
}

const allFiles: string[] = [];
walk(srcDir, f => allFiles.push(f));
walk(apiDir, f => allFiles.push(f));

allFiles.forEach(file => {
  const relativePath = path.relative(rootDir, file).replace(/\\/g, '/');
  let type: any = 'lib';
  if (relativePath.startsWith('src/pages')) type = 'page';
  else if (relativePath.startsWith('src/components')) type = 'component';
  else if (relativePath.startsWith('api/')) type = 'api';
  else if (relativePath.startsWith('src/hooks')) type = 'hook';
  else if (relativePath.startsWith('src/contexts')) type = 'context';

  graph.nodes.push({ id: relativePath, type });

  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /import\s+.*\s+from\s+['"](.*)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    let importPath = match[1];
    if (importPath.startsWith('@/')) {
      importPath = importPath.replace('@/', 'src/');
    } else if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const dir = path.dirname(relativePath);
      importPath = path.join(dir, importPath).replace(/\\/g, '/');
    } else {
      continue; // Skip third-party
    }

    // Try to find the actual file
    const possibleExts = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
    let target = '';
    for (const ext of possibleExts) {
      const p = importPath.endsWith(ext) ? importPath : importPath + ext;
      if (fs.existsSync(path.join(rootDir, p.endsWith('/') ? p.slice(0, -1) : p))) {
        target = p;
        break;
      }
    }

    if (target) {
      graph.links.push({ source: relativePath, target });
    }
  }
});

fs.writeFileSync(path.join(rootDir, 'dependency_graph.json'), JSON.stringify(graph, null, 2));
console.log('Dependency graph generated successfully.');
