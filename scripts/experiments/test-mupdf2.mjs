import fs from 'fs';
const dts = fs.readFileSync(new URL('../../node_modules/mupdf/dist/mupdf.d.ts', import.meta.url), 'utf8');
const dw = dts.split('class Document ')[1].split('}')[0];
console.log(dw);
