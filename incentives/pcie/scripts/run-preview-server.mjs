import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distIndexPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(distIndexPath)) {
  console.error('Production preview requires an existing dist build. Run "npm run build" first.');
  process.exit(1);
}

process.env.NODE_ENV = 'production';

await import('../server.ts');