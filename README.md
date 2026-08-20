# PDF Data Extractor - GitHub Pages

Static browser application for extracting data from scanned/image-based and native PDFs.

## Main features
- Runs on GitHub Pages with no backend.
- Renders every PDF page and applies Arabic + English OCR.
- Local Arabic and English Tesseract trained-data files are included.
- Extracts OCR text, OCR word coordinates/confidence, native text/items, page size/rotation, annotations, outline/metadata, and PDF operator counts.
- Exports UTF-8 TXT, JSON, CSV, and a complete ZIP package.
- Optional rendered-page PNG export.
- Processes one page at a time and limits render size to reduce browser memory pressure.
- The selected PDF is processed locally in the browser and is not uploaded by this application.

## Runtime libraries
The app pins these browser libraries:
- PDF.js 6.2.108
- Tesseract.js 7.0.0
- Tesseract.js Core 6.1.2
- JSZip 3.10.1

The JavaScript libraries are loaded from jsDelivr. The OCR language data is served locally from `assets/tessdata`.

## Publish on GitHub Pages
1. Create a GitHub repository.
2. Upload every file and folder from this package to the repository root.
3. Open repository **Settings > Pages**.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select the `main` branch and `/(root)` folder, then save.
6. GitHub will publish the site at `https://YOUR-USERNAME.github.io/REPOSITORY/`.

No build command is required.

## OCR runtime fix - August 2026
The OCR loader now uses Tesseract.js 7.0.0 with the matching Tesseract.js-core 7.0.0 runtime.
It explicitly loads the LSTM WebAssembly core to avoid Relaxed-SIMD loader failures seen in some GitHub Pages/browser/network combinations.
The loader tries unpkg first and jsDelivr second. Arabic and English traineddata remain hosted locally in this repository.
JSZip is now included locally under assets/vendor/jszip.min.js.
