import * as mupdf from 'mupdf';
import { PDFDocument } from 'pdf-lib';

async function test() {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([500, 500])
  page.drawText('Test', { x: 50, y: 400 })
  const pdfBytes = await pdfDoc.save()
  
  let doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  let mpage = doc.loadPage(0);
  let outData = new mupdf.Buffer();
  let drw = new mupdf.DocumentWriter(outData, "svg", "");
  let dev = drw.beginPage(mpage.getBounds());
  mpage.run(dev, mupdf.Matrix.identity);
  dev.close();
  drw.endPage();
  drw.close();
  
  console.log("SVG size:", outData.asUint8Array().length);
  
  dev.destroy();
  drw.destroy();
  outData.destroy();
  mpage.destroy();
  doc.destroy();
  console.log("Destroyed successfully!");
}
test();
