import * as fs from 'fs';
const pdfMjs = fs.readFileSync('node_modules/pdfjs-dist/build/pdf.mjs', 'utf8');
console.log('SVGGraphics found:', pdfMjs.includes('SVGGraphics'));
