# PDF Declaration Extractor - GitHub Pages

**Version:** 1.0.3  
**Developed By A. ElHawary**

Static browser application for extracting exactly one customs declaration record from each scanned PDF and exporting the result to the supplied Excel format.

## Ver. 1.0.3 extraction strategy
- Exactly one declaration result is produced per PDF.
- Every PDF page is OCR-scanned; the highest-scoring declaration-form page is selected.
- Page selection no longer depends on the first OCR pass reading `Customs` / `جمرك` perfectly.
- The form structure itself is scored using Goods/الطرود, VALUE, Date, Supplier/Invoice/P.Order/Gross Wt. indicators.
- After the best page is selected, its top 34% is OCR-read a second time with sparse-text segmentation for Dec. No. and Date.
- A blank or uncertain field no longer discards the entire PDF record.
- Invoice/Invoices No. remains excluded from Dec. No. candidates.
- Description is captured below Goods/الطرود, quantity/unit prefixes are removed, and `DETAILS AS PER THE INV.'S ATT` is excluded.
- VALUE is taken from the VALUE row and supports OCR that splits decimals, e.g. `9290. 86` -> `9290.86`.
- Arabic + English OCR is preserved.
- PDFs are processed locally in the browser.

## Deployment
Upload all files in this folder to the GitHub Pages repository root. After replacing the previous version, use `Ctrl+F5` once so the browser loads Ver. 1.0.3 modules.
