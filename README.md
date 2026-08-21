# PDF Declaration Extractor - GitHub Pages

**Version:** 1.0.2  
**Developed By A. ElHawary**

Static browser application for extracting one customs declaration from each scanned PDF and exporting the result to the supplied Excel format.

## Extraction rules
- Exactly one declaration result per PDF.
- The app scans every PDF page and selects the highest-scoring declaration header instead of stopping at the first page containing a Customs-related word.
- Strong page indicators are `Customs Declaration`, `Customs`, and Arabic declaration-header text such as `إقرار جمركي` / `بيان جمركي` near the top of the page.
- Generic Arabic legal text containing words such as `الجمركية` is not enough by itself to select the page.
- Dec. No. must be in the upper declaration area and supports formats such as `5050/2016`, `SH/5050/2016`, and equivalent variable prefixes.
- `Invoice No.` / `Invoices No.` values are excluded from Dec. No. candidates.
- Declaration date is selected from the same upper declaration area and favors `Date` / `التاريخ`.
- Description is captured below `Goods` / `الطرود` and stops at the VALUE row.
- `DETAILS AS PER THE INV.'S ATT` is excluded and acts as a hard description stop.
- Dollar value is taken from the VALUE row and ignores isolated one-digit OCR errors around the `$` symbol.
- Arabic + English OCR is preserved.
- PDFs are processed locally in the browser and are not uploaded by the application.

## Deployment
Upload the contents of this folder to the GitHub Pages repository root. After replacing an older release, hard-refresh the browser (`Ctrl+F5`).


## Ver. 1.0.2
- Description quantity/unit prefixes such as `6 EA :` are removed.
- OCR garbage versions of the same prefix, such as `0 0 6 مع :`, are removed.
- A trailing OCR-misread `(` is repaired to `)` when it is clearly the unmatched closing bracket of the description.
- `DETAILS AS PER THE INV.'S ATT` and close OCR variants remain excluded from Description.
