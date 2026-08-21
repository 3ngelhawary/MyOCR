# PDF Declaration Extractor - GitHub Pages

**Version:** 1.0.0  
**Developed By A. ElHawary**

Static browser application for extracting one customs declaration from each scanned PDF and exporting the results to the supplied Excel format.

## Current extraction rules
- One declaration per PDF.
- Prefer the page containing `Customs` or `جمرك`.
- Declaration number is taken from the Customs declaration header, with formats such as `5050/2016`, `SH/5050/2016`, or another letter/number prefix followed by `/number/year`.
- `Invoice No.` / `Invoices No.` values are excluded from declaration-number candidates.
- Declaration date is taken from the same declaration page.
- Description is captured below `Goods` / `الطرود` and can span multiple OCR lines.
- `DETAILS AS PER THE INV.'S ATT` and equivalent OCR variants are ignored.
- Dollar value is taken from the `VALUE` row and prefers the complete numeric amount.
- Arabic + English OCR is preserved.
- PDFs are processed in the browser and are not uploaded by the application.

## Deployment
Upload the contents of this folder to the GitHub Pages repository root. After replacing an older release, hard-refresh the browser (`Ctrl+F5`).
