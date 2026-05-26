import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
Object.keys(pdfjs).forEach(k => {
  if(k.toLowerCase().includes('svg')) console.log('Export:', k);
});
