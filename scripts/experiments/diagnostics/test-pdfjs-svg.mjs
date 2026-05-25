import * as fs from 'fs';
const pdfMjs = fs.readFileSync(new URL('../../../node_modules/pdfjs-dist/build/pdf.mjs', import.meta.url), 'utf8');
console.log('SVGGraphics found:', pdfMjs.includes('SVGGraphics'));
