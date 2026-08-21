# PDF Declaration Extractor - GitHub Pages

**Version:** 1.0.7  
**Developed By A. ElHawary**

Static browser application for extracting one customs declaration record from each scanned PDF and exporting the result to the supplied Excel format.

## Ver. 1.0.7 changes
- Built directly on Ver. 1.0.6.
- Each PDF now starts with a brand-new Tesseract OCR worker.
- The OCR worker is terminated immediately after that PDF finishes.
- OCR parameters and temporary worker state therefore cannot carry from one PDF into the next.
- Page scanning uses a local per-PDF page collection and commits it to the final results only after the PDF finishes.
- Temporary render canvases are released immediately after each page and validation pass.
- PDF.js loading tasks are destroyed before the next PDF starts.
- Result tables are refreshed after each completed PDF instead of after every OCR page, reducing browser CPU and memory pressure in large batches.
- DPI, Customs-page scoring, Dec. No., Date, Description, VALUE decimal validation, and Excel export rules are unchanged from Ver. 1.0.6.
- Goal: the same PDF should produce the same extraction whether processed alone or inside a batch.

## Deployment
Upload all files in this folder to the GitHub Pages repository root. After replacing the previous version, use `Ctrl+F5` once so the browser loads Ver. 1.0.7 modules.
