import { execSync } from 'child_process';
try {
  console.log('GS:', execSync('gs --version').toString());
} catch (e) {
  console.log('GS not found');
}
try {
  console.log('QPDF:', execSync('qpdf --version').toString());
} catch (e) {
  console.log('QPDF not found');
}
