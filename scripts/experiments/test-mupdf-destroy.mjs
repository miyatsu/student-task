import fs from 'fs';
import * as mupdf from 'mupdf';

const pdfBytes = fs.readFileSync(new URL('../../node_modules/mupdf/dist/mupdf.d.ts', import.meta.url), 'utf8');
const lines = pdfBytes.split('\n');
const userDataLine = lines.find(l => l.includes('destroy()'));
console.log('destroy exists?', !!userDataLine);
