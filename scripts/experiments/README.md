# Experimental Scripts

This directory contains manual and exploratory scripts that are intentionally kept out of the automated test and production script paths.

Current groups:

- `test-cli.ts`, `test-complex.ts`, `test-server.ts`, `test-tools.js`: local app and runtime experiments.
- `test-gs.mjs`: Ghostscript-related exploration.
- `test-mupdf*.mjs`: MuPDF capability and API behavior checks.
- `test-pdfjs-svg.mjs`, `test-svg.mjs`: SVG and pdf.js rendering experiments.

Run these scripts from the project root so package resolution and relative paths stay predictable.