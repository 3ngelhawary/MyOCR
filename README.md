# PDF Declaration Data Extractor - GitHub Pages

Static browser application for scanned Arabic/English declaration PDFs.

## Main workflow
1. Select one or more PDFs.
2. Each PDF is treated as containing exactly one declaration.
3. Pages are OCR-scanned locally until the declaration page is identified.
4. A page containing `Customs` or `جمرك` has priority over all other pages.
5. From that page the app extracts:
   - Dec. No.
   - declaration date from the same page
   - full Description below `Goods` or `الطرود`
   - Value below `VALUE $`
6. Export to Excel using the included sample workbook layout.

## Declaration number rules
Supported examples:
- `123/2016`
- `1234/2016`
- `12345/2016`
- optional variable prefix such as `ABC./12345/2016`

Declaration numbers are selected using nearby `Dec. No.`, `Declaration No.`, or `رقم البيان` context. Numbers associated with `Invoice` / `Inv.` are rejected so invoice numbers are not used as declaration numbers.

## Description rules
Description is collected across multiple lines below `Goods` / `الطرود` until the next recognized field. The phrase `details as per inv's att` is removed from the extracted description.

## Excel layout
The included `assets/templates/declaration-template.xlsx` is the supplied sample template. Each PDF creates at most one declaration entry. Each declaration uses two rows: the declaration number is on the first row and the declaration date is on the second row of the Dec. No. column. Value and Description remain merged across the two rows. Other sample columns are preserved and left blank because they are outside the requested extraction scope.

## Privacy
PDFs are processed in the browser and are not uploaded by this application.
