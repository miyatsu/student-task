import { PDFDocument } from 'pdf-lib';

async function test() {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([500, 500])
  page.drawText('Test SVG Convert', { x: 50, y: 400 })
  const pdfBytes = await pdfDoc.save()
  
  const form = new FormData();
  form.append('format', 'svg');
  // Blob conversion
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  form.append('pdf', blob, 'test.pdf');

  try {
    const res = await fetch('http://localhost:3000/api/pdf2img', {
      method: "POST",
      body: form
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      console.log('Format:', json.format);
      console.log('Pages length:', json.pages ? json.pages.length : 0);
      if(json.pages && json.pages[0]) {
         console.log('First page starts with:', json.pages[0].substring(0, 50));
      } else {
         console.log('Error:', json);
      }
    } catch(e) {
      console.log('Error parsing JSON. Raw res: ', text);
    }
  } catch(e) {
    console.error(e);
  }
}
test();
