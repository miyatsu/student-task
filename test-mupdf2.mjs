import fs from 'fs';
const dts = fs.readFileSync('node_modules/mupdf/dist/mupdf.d.ts', 'utf8');
const dw = dts.split('class Document ')[1].split('}')[0];
console.log(dw);
