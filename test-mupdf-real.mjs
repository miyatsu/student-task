import { PDFDocument } from 'pdf-lib';
import * as mupdf from 'mupdf';
import fs from 'fs';

async function test() {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([500, 500])
  page.drawText('Hello SVG', { x: 50, y: 400 })
  const pdfBytes = await pdfDoc.save()
  
  let doc = mupdf.Document.openDocument(pdfBytes, "application/pdf");
  let outData = new mupdf.Buffer();
  let drw = new mupdf.DocumentWriter(outData, "svg", "");
  
  let mpage = doc.loadPage(0);
  let dev = drw.beginPage(mpage.getBounds());
  mpage.run(dev, mupdf.Matrix.identity);
  dev.close();
  drw.endPage();
  drw.close();
  
  const svgText = Buffer.from(outData.asUint8Array()).toString("utf8");
  console.log("SVG Starts With:", svgText.substring(0, 300));
}
test();
