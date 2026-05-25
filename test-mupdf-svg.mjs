import * as mupdf from "mupdf";
const pdfStream = "JVBERi0xLjEKJcOkw7zDtsOfCjIgMCBvYmoKPDwgL0FjdGlvbiA8PCAvUyAvR29UbyAvRCBbIDQgMCBSIC9GaXRIIDEwMTEgXSA+PiAvVGl0bGUgKEFsd2F5cyB0byBDaGVja1ZlbGkpIC9QYXJlbnQgMyAwIFIKPj4KZW5kb2JqCjEgMCBvYmoKPDwgL091dGxpbmVzIDMgMCBSIC9QYWdlcyA1IDAgUiAvVHlwZSAvQ2F0YWxvZyA+PgplbmRvYmoKMyAwIG9iago8PCAvRmlyc3QgMiAwIFIgL0xhc3QgMiAwIFIgPj4KZW5kb2JqCjYgMCBvYmoKPDwgL0xlbmd0aCA4NjkgPj4Kc3RyZWFtCjIuMjQgLTIuOTIgVEQKL0YxIDEgVGYKMS43NSAtMC41NSBUREQKL0YyIDEgVGYKMS43NSAtMC41NSBUREQKL0YxIDEgVGYKLzQgMSBUZgowIDEgVEQKMCAtMSBURAplbmRzdHJlYW0KZW5kb2JqCjQgMCBvYmoKPDwgL01lZGlhQm94IFsgMCAwIDU5NS4yOCA4NDEuODkgXSAvUmVzb3VyY2VzIDw8IC9Gb250cyA8PCAvRjEgPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+IC9GMiA8PCAvVHlwZSAvRm9udCAvU3VidHlwZSAvVHlwZTEgL0Jhc2VGb250IC9IZWx2ZXRpY2EtQm9sZCA+PiA+PiA+PiAvQ29udGVudHMgNiAwIFIgL1R5cGUgL1BhZ2UgL1BhcmVudCA1IDAgUiA+PgplbmRvYmoKNSAwIG9iago8PCAvSWRzIFsgNCAwIFIgXSAvQ291bnQgMSAvVHlwZSAvUGFnZXMgPj4KZW5kb2JqCnhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZgowMDAwMDAwMDkwIDAwMDAwIG4KMDAwMDAwMDAxNyAwMDAwMCBuCjAwMDAwMDAxNjYgMDAwMDAgbgowMDAwMDAwMzM1IDAwMDAwIG4KMDAwMDAwMDU0MiAwMDAwMCBuCjAwMDAwMDAyMjAgMDAwMDAgbgp0cmFpbGVyCjw8IC9Sb290IDEgMCBSIC9TaXplIDcgPj4Kc3RhcnR4cmVmCjYxMQolJUVPRg==";
const pdfData = Buffer.from(pdfStream, "base64");

try {
  let doc = mupdf.Document.openDocument(pdfData, "application/pdf");
  let outData = new mupdf.Buffer();
  let drw = new mupdf.DocumentWriter(outData, "svg", "");
  
  let page = doc.loadPage(0);
  let dev = drw.beginPage([0, 0, 500, 500]);
  
  page.run(dev, mupdf.Matrix.identity);
  dev.close();
  drw.endPage();
  drw.close();
  
  const svgText = Buffer.from(outData.asUint8Array()).toString("utf8");
  console.log("SUCCESS! SVG starts with:");
  console.log(svgText.substring(0, 500));
} catch(e) {
  console.error("FAILED:", e);
}
