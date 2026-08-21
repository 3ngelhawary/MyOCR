# PDF Declaration Extractor - GitHub Pages

**Version:** 1.0.5  
**Developed By A. ElHawary**

Static browser application for extracting exactly one customs declaration record from each scanned PDF and exporting the result to the supplied Excel format.

## Ver. 1.0.5 extraction strategy
- Exactly one declaration result is produced per PDF.
- Every page receives the normal Arabic + English OCR pass and the strongest Customs declaration page is selected.
- The selected page then receives an independent high-resolution validation pass at a minimum of 400 DPI.
- The validation pass uses separate field crops rather than re-reading the whole page:
  - Header crop for Dec. No. and Date.
  - Goods crop for Description.
  - VALUE-row crop for the dollar amount.
- The Goods and VALUE crops are independently enlarged, converted to grayscale, and contrast-enhanced before OCR.
- VALUE first uses a narrow full-text row pass; if no usable amount is found, a second stronger numeric/currency OCR pass is used.
- Primary and validation results are compared before the final declaration record is written.
- The heading `Number, Kind of Package & Description of Goods` is always stripped from Description.
- Quantity/unit prefixes are removed, including OCR variants such as `5 EA :`, `5 68 :`, `5 E8 :`, and `6 EA :`.
- `DETAILS AS PER THE INV.'S ATT` and OCR variants remain excluded.
- Invoice/Invoices No. remains excluded from Dec. No.
- Arabic + English OCR is preserved.
- PDFs are processed locally in the browser.

## Deployment
Upload all files in this folder to the GitHub Pages repository root. After replacing the previous version, use `Ctrl+F5` once so the browser loads Ver. 1.0.5 modules.
