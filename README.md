# PDF Declaration Extractor - GitHub Pages

**Version:** 1.0.6  
**Developed By A. ElHawary**

Static browser application for extracting one customs declaration record from each scanned PDF and exporting the result to the supplied Excel format.

## Ver. 1.0.6 changes
- Preserves the Ver. 1.0.5 one-declaration-per-PDF and dual-validation workflow.
- Description cleanup now removes OCR-corrupted bilingual field-heading text before the actual goods description.
- Example: `E الخلرود ase y الرسالة توصيف 0 OILWELL SUPPLIES ( GASKET, RING )` becomes `OILWELL SUPPLIES ( GASKET, RING )`.
- Leading quantity/unit prefixes such as `5 EA :`, `5 68 :`, and similar OCR variants remain excluded.
- VALUE now has an additional decimal-search layer. When the normal VALUE OCR has no two-decimal separator, the same narrow VALUE band is re-read up to three times at higher magnification with currency-only OCR settings.
- The additional passes use different segmentation and threshold settings to recover a faint `.` or `,`.
- Explicit two-decimal OCR results always win during validation.
- If every VALUE pass still loses the separator, an unpunctuated currency value with at least four digits is interpreted with the final two digits as cents; for example `21702` becomes `217.02`.
- Description, Dec. No., Date, Customs-page selection, and Excel layout remain otherwise unchanged.

## Deployment
Upload all files in this folder to the GitHub Pages repository root. After replacing the previous version, use `Ctrl+F5` once so the browser loads Ver. 1.0.6 modules.
