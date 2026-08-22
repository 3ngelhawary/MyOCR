import { loadPdf, extractPageData, renderPage, canvasToPngBlob, releaseCanvas } from "./pdf-service.js?v=1.0.8";
import { createOcrWorker, recognizePage, recognizeRegion, recognizeRegionEnhanced, terminateOcrWorker, hasOcrWorker } from "./ocr-service.js?v=1.0.8";
import { extractDeclaration, getCustomsPageScore } from "./declaration-extractor.js?v=1.0.8";
import { getFieldRegions } from "./field-regions.js?v=1.0.8";
import { recognizeValueDecimalLayers, hasTwoDecimalValue } from "./value-ocr.js?v=1.0.8";
import { buildNativeWords, nativeTextQuality } from "./native-words.js?v=1.0.8";
import { $, setProgress, reportOcrProgress } from "./ui.js?v=1.0.8";
import { renderResults } from "./results-table.js?v=1.0.8";

export async function scanFiles(state, settings) {
  for (let index = 0; index < state.files.length && !state.stopRequested; index++) {
    const file = state.files[index];
    try {
      await scanOneFile(file, index, state, settings);
    } catch (error) {
      state.failures.push({ fileName: file.name, message: error?.message || String(error) });
      setProgress($("progressBar").value, `Skipped ${file.name}`,
        `${file.name} failed: ${error?.message || error}. Continuing with the remaining PDFs.`);
    } finally {
      await terminateOcrWorker();
      renderResults(state);
    }
  }
}

async function scanOneFile(file, index, state, settings) {
  setProgress((index / state.files.length) * 100, `Opening ${file.name}`, "Finding the strongest Customs declaration page...");
  const loaded = await loadPdf(file), filePages = [];
  let best = null;
  try {
    for (let pageNo = 1; pageNo <= loaded.pdf.numPages && !state.stopRequested; pageNo++) {
      const unit = 100 / state.files.length;
      state.progressBase = index * unit + ((pageNo - 1) / loaded.pdf.numPages) * unit;
      state.progressSpan = unit / loaded.pdf.numPages;
      setProgress(state.progressBase, `${file.name} - page ${pageNo}/${loaded.pdf.numPages}`, "Reading page structure...");
      const page = await readPage(loaded.pdf, pageNo, file.name, settings);
      filePages.push(page);
      const score = getCustomsPageScore(page);
      if (!best || score > best.score) best = { page, score };
    }
    if (best && best.page.textSource === "ocr" && !state.stopRequested) await refinePage(best.page, loaded.pdf, settings);
    if (best) state.declarations.push(extractDeclaration(best.page, file.name, settings));
    state.pages.push(...filePages);
    state.documents.push({ fileName: file.name, pageCount: loaded.pdf.numPages, metadata: loaded.metadata, outline: loaded.outline });
  } finally {
    if (typeof loaded.loadingTask?.destroy === "function") await loaded.loadingTask.destroy().catch(() => {});
    else if (typeof loaded.pdf?.cleanup === "function") await loaded.pdf.cleanup().catch(() => {});
  }
}

async function readPage(pdf, pageNo, fileName, settings) {
  const data = await extractPageData(pdf, pageNo);
  const nativeWords = settings.textSource === "ocr" || data.rotation % 360 !== 0
    ? [] : buildNativeWords(data.nativeItems, data.heightPt);
  if (nativeTextQuality(nativeWords) >= 45) {
    setProgress($("progressBar").value, `${fileName} - page ${pageNo}`, "Embedded text layer found - reading it directly (no OCR needed).");
    const page = buildPage(fileName, pageNo, data, { width: data.widthPt, height: data.heightPt, dpi: 72 },
      { text: data.nativeText, words: nativeWords, lines: [], confidence: 100 }, "native");
    if (settings.includeImages) page.pageImageBlob = await renderToBlob(data.page, settings.dpi);
    return page;
  }
  await ensureWorker(fileName);
  const rendered = await renderPage(data.page, settings.dpi);
  try {
    const blob = settings.includeImages ? await canvasToPngBlob(rendered.canvas) : null;
    const ocr = await recognizePage(rendered.canvas, rendered.effectiveDpi);
    const page = buildPage(fileName, pageNo, data,
      { width: rendered.canvas.width, height: rendered.canvas.height, dpi: rendered.effectiveDpi }, ocr, "ocr");
    page.pageImageBlob = blob;
    return page;
  } finally { releaseCanvas(rendered.canvas); }
}

async function refinePage(page, pdf, settings) {
  setProgress($("progressBar").value, `${page.sourceFile} - validation pass`, "Running independent field OCR and cross-validation...");
  const pdfPage = await pdf.getPage(page.pageNumber), rendered = await renderPage(pdfPage, Math.max(settings.dpi, 400));
  try {
    const regions = getFieldRegions(page);
    const header = await recognizeRegion(rendered.canvas, rendered.effectiveDpi, scaleRegion(regions.header, page, rendered.canvas), "11");
    page.headerOcrText = header.text; page.headerOcrWords = header.words;
    const descRegion = scaleRegion(regions.description, page, rendered.canvas), valueRegion = scaleRegion(regions.value, page, rendered.canvas);
    const desc = await recognizeRegionEnhanced(rendered.canvas, rendered.effectiveDpi, descRegion, { pageSegMode: "6", scale: 1.5, threshold: null, contrast: 1.35 });
    let value = await recognizeRegionEnhanced(rendered.canvas, rendered.effectiveDpi, valueRegion, { pageSegMode: "6", scale: 1.8, threshold: null, contrast: 1.45 });
    if (!/\d{2,}/.test(value.text)) value = await recognizeRegionEnhanced(rendered.canvas, rendered.effectiveDpi, valueRegion,
      { pageSegMode: "6", scale: 2.1, threshold: "auto", contrast: 1.8, whitelist: "0123456789.,$ " });
    page.descriptionOcrText = desc.text; page.valueOcrText = value.text;
    if (!hasTwoDecimalValue(value.text)) page.valueDecimalOcrText = (await recognizeValueDecimalLayers(rendered.canvas, rendered.effectiveDpi, valueRegion)).join("\n");
  } finally { releaseCanvas(rendered.canvas); }
}

async function ensureWorker(fileName) {
  if (hasOcrWorker()) return;
  setProgress($("progressBar").value, `Preparing ${fileName}`, "Starting a fresh OCR worker for this PDF...");
  await createOcrWorker(reportOcrProgress);
}

async function renderToBlob(pdfPage, dpi) {
  const rendered = await renderPage(pdfPage, dpi);
  try { return await canvasToPngBlob(rendered.canvas); } finally { releaseCanvas(rendered.canvas); }
}

function scaleRegion(region, page, canvas) {
  const sx = canvas.width / (page.renderWidth || canvas.width), sy = canvas.height / (page.renderHeight || canvas.height);
  return { left: region.left * sx, top: region.top * sy, width: region.width * sx, height: region.height * sy };
}

function buildPage(fileName, pageNo, data, box, text, textSource) {
  return { sourceFile: fileName, pageNumber: pageNo, widthPt: data.widthPt, heightPt: data.heightPt, rotation: data.rotation,
    renderWidth: box.width, renderHeight: box.height, effectiveDpi: box.dpi, textSource,
    nativeText: data.nativeText, nativeItems: data.nativeItems, annotations: data.annotations, operationCount: data.operationCount,
    ocrText: text.text, ocrWords: text.words, ocrLines: text.lines, ocrConfidence: text.confidence, pageImageBlob: null };
}
