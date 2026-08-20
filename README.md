# PDF Declaration Data Extractor - GitHub Pages

Static browser application for scanned Arabic/English declaration PDFs.

## Main workflow
1. Select one or more PDFs.
2. The browser renders and OCRs every page locally.
3. Declaration pages are detected from the declaration-number pattern.
4. From the same page the app extracts:
   - Dec. No.
   - declaration date
   - Description below `Goods` or `الطرود`
   - Value below `VALUE $`
5. Export to Excel using the included sample workbook layout.

## Declaration number patterns
- `123/2016`
- `1234/2016`
- `12345/2016`
- optional variable prefix followed by `/`, then the number/year form.

## Excel layout
The included `assets/templates/declaration-template.xlsx` is the supplied sample template.
Each declaration uses two rows. The declaration date is written on the second row of the Dec. No. column. Value and Description remain merged across the two rows. Other sample columns are preserved and left blank because they are not part of the requested extraction scope.

## Privacy
PDFs are processed in the browser and are not uploaded by this application.
