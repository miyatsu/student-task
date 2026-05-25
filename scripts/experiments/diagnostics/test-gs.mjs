import { execSync } from 'child_process';
try {
  const out = execSync('gs -h').toString();
  console.log('Devices:', out.split('Available devices:')[1].split('\n\n')[0]);
} catch(e) {}
