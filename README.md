# PDF Declaration Extractor - GitHub Pages

**Version:** 1.0.8  
**Developed By A. ElHawary**

Static browser application for extracting one customs declaration record from each PDF and exporting the result to the supplied Excel format. Nothing is uploaded; every PDF is processed locally in the browser.

## What is new in Ver. 1.0.8

### Corrections
- **Batch-stopping OCR fault fixed.** `value-ocr.js` imported the OCR service under a different cache tag than `app.js`, which created a second module instance with no worker. Any PDF whose VALUE lacked a clean two-decimal reading threw *OCR worker is not initialized* and killed the rest of the batch. All internal imports now share one tag.
- **One bad PDF no longer stops the batch.** Failures are captured per file and listed under **Skipped PDFs**.
- **CDN failures are visible.** PDF.js loads through jsDelivr with an unpkg fallback, and a watchdog reports a module load failure instead of leaving the page inert.
- **Decimal recovery is now honest.** Ver. 1.0.7 silently turned any 4-digit-plus whole number into a decimal, so a genuine value of 1234 became 12.34. Recovery is now evidence based by default and every recovered value is flagged.

### Extraction improvements
- **Text-layer reading.** Digitally generated PDFs are read straight from their embedded text with full word geometry - no OCR, no rendering, near-perfect accuracy and a large speed gain. Scanned PDFs still go through the OCR path. Selectable under **Text source**.
- **More fields.** Shahada No., Kasima No., Kasima Date, Invoice No., Packages, Gross Weight and Currency are extracted alongside Dec. No., Date, Description and Value. Shahada and Kasima now fill columns C and D of the Excel template.
- **Better targeting.** The header validation pass aims at the detected Dec. No. band, labelled fields are read from the text after the label so several fields on one line resolve correctly, and a labelled Dec. No. or Date line is no longer discarded because an invoice line sits next to it.
- **Stronger VALUE reading.** Otsu automatic thresholding, a fourth decimal pass, and a last-resort inference from the largest two-decimal amount on the page.
- **Review before export.** Every declaration cell is editable in the Declarations tab; edits feed the Excel, CSV, JSON and ZIP exports. Rows needing attention are highlighted and flagged.

## Deployment
Upload all files in this folder to the GitHub Pages repository root. After replacing the previous version, use `Ctrl+F5` once so the browser loads the Ver. 1.0.8 modules.
