# Deploy to GitHub Pages

1. Create a new GitHub repository, for example `pdf-data-extractor`.
2. Upload the complete contents of this folder to the repository root.
3. Commit the files to the `main` branch.
4. Open **Settings** in the repository.
5. Open **Pages** under **Code and automation**.
6. Set **Source** to **Deploy from a branch**.
7. Select **main** and **/(root)**.
8. Click **Save**.

The published address will normally be:

`https://YOUR-USERNAME.github.io/pdf-data-extractor/`

## Important
- Do not remove `.nojekyll`.
- Keep the `assets/tessdata` folder because it contains the Arabic and English OCR models.
- Users need internet access to load the pinned PDF.js and Tesseract.js engines. JSZip ships with this folder.
- `.nojekyll` is included in this folder and must stay in the repository root.
- The selected PDF itself is processed locally by JavaScript in the browser; this project contains no upload endpoint or backend.
