import fs from 'fs';
import * as mupdf from 'mupdf';
import { execSync } from 'child_process';

const pdfBytes = execSync('curl -sL https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
console.log('PDF bytes length:', pdfBytes.length);

try {
  const doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  const count = doc.countPages();
  console.log('Pages:', count);
  
  for (let i = 0; i < count; i++) {
    const page = doc.loadPage(i);
    const outData = new mupdf.Buffer();
    const drw = new mupdf.DocumentWriter(outData, "svg", "");
    const dev = drw.beginPage(page.getBounds());
    page.run(dev, mupdf.Matrix.identity);
    dev.close();
    drw.endPage();
    drw.close();
    const svgText = Buffer.from(outData.asUint8Array()).toString("utf8");
    console.log(`Page ${i} SVG length:`, svgText.length);
  }
} catch (e) {
  console.error("Error:", e);
}
