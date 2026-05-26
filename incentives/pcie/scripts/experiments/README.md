# Experimental Scripts

This directory contains developer-facing manual checks, diagnostics, and feasibility spikes.

These files are intentionally kept out of the automated test tree:

- They do not act as CI-style regression tests.
- Several scripts depend on a live local server, local binaries, or interactive inspection.
- They are meant for on-demand investigation, not for `npm test`.

Current structure:

- `diagnostics/`: environment and library introspection scripts such as CLI availability, Ghostscript capability checks, MuPDF API inspection, and pdf.js feature probing.
- `manual/`: scripts that exercise a live server or multi-step local workflow and are best treated as manual verification helpers.
- `spikes/`: one-off feasibility experiments for MuPDF SVG generation and resource cleanup behavior.

Run these scripts from the project root so package resolution, server URLs, and relative paths stay predictable.