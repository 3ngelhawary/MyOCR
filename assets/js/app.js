import { state, resetResults } from "./state.js";
import { loadPdf, extractPageData, renderPage, canvasToPngBlob } from "./pdf-service.js?v=20260820-1";
import { createOcrWorker, recognizePage, terminateOcrWorker } from "./ocr-service.js";
import { extractDeclarations, getCustomsPageScore } from "./declaration-extractor.js?v=1.0.1";
import { exportDeclarationExcel } from "./excel-export.js";
import { $, initTabs, renderResults, setBusy, setProgress } from "./ui.js";
import { exportTxt, exportJson, exportWordsCsv, exportZip } from "./export-service.js";

initTabs(); wireFileInput(); wireActions(); setBusy(false, false, false);

function wireFileInput() {
  const zone = $("dropZone");
  zone.addEventListener("click", () => $("fileInput").click());
  zone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") $("fileInput").click(); });
  $("fileInput").addEventListener("change", e => acceptFiles(e.target.files));
  for (const name of ["dragenter","dragover"]) zone.addEventListener(name, e => { e.preventDefault(); zone.classList.add("drag"); });
  for (const name of ["dragleave","drop"]) zone.addEventListener(name, e => { e.preventDefault(); zone.classList.remove("drag"); });
  zone.addEventListener("drop", e => acceptFiles(e.dataTransfer.files));
}

function wireActions() {
  $("scanButton").addEventListener("click", scan);
  $("stopButton").addEventListener("click", () => { state.stopRequested = true; $("detailText").textContent = "Stopping after the current page..."; });
  $("clearButton").addEventListener("click", clearAll);
  $("exportExcel").addEventListener("click", async () => { try { await exportDeclarationExcel(state); } catch (e) { showError(e); } });
  $("exportTxt").addEventListener("click", () => exportTxt(state));
  $("exportJson").addEventListener("click", () => exportJson(state));
  $("exportCsv").addEventListener("click", () => exportWordsCsv(state));
  $("exportZip").addEventListener("click", async () => { try { await exportZip(state); } catch (e) { showError(e); } });
}

function acceptFiles(fileList) {
  const files = [...(fileList || [])].filter(f => f.name.toLowerCase().endsWith(".pdf"));
  if (!files.length) return showError(new Error("Please select one or more PDF files."));
  resetResults(); state.files = files; clearOutputs();
  $("fileName").textContent = files.length === 1 ? files[0].name : `${files.length} PDF files selected`;
  $("fileSize").textContent = formatBytes(files.reduce((n,f) => n + f.size, 0));
  setProgress(0, "Ready", "One declaration will be extracted per PDF. The Customs / جمرك page has priority.");
  setBusy(false, true, false);
}

async function scan() {
  if (!state.files.length || state.running) return;
  state.running = true; state.stopRequested = false; state.startedAt = new Date().toISOString();
  state.pages = []; state.declarations = []; state.documents = []; setBusy(true, true, false);
  const dpi = Number($("dpiSelect").value), includeImages = $("includeImages").checked;
  try {
    await waitForLibraries(); await createOcrWorker(m => handleOcrProgress(m));
    for (let f = 0; f < state.files.length && !state.stopRequested; f++) await scanFile(state.files[f], f, dpi, includeImages);
    state.completedAt = new Date().toISOString();
    setProgress(state.stopRequested ? $("progressBar").value : 100, state.stopRequested ? "Stopped" : "Completed",
      `Detected ${state.declarations.length} declaration record(s) from ${state.pages.length} processed page(s).`);
  } catch (e) { showError(e); }
  finally { await terminateOcrWorker(); state.running = false; setBusy(false, true, state.pages.length > 0); }
}

async function scanFile(file, fileIndex, dpi, includeImages) {
  setProgress((fileIndex / state.files.length) * 100, `Opening ${file.name}`, "Scanning every page and selecting the best Customs declaration header...");
  const loaded = await loadPdf(file);
  let best = null;
  try {
    state.documents.push({ fileName: file.name, pageCount: loaded.pdf.numPages, metadata: loaded.metadata, outline: loaded.outline });
    for (let pageNo = 1; pageNo <= loaded.pdf.numPages && !state.stopRequested; pageNo++) {
      const unit = 100 / state.files.length, base = fileIndex * unit + ((pageNo - 1) / loaded.pdf.numPages) * unit;
      state.progressBase = base; state.progressSpan = unit / loaded.pdf.numPages;
      setProgress(base, `${file.name} - page ${pageNo}/${loaded.pdf.numPages}`, "OCR scanning and scoring the declaration header...");
      const data = await extractPageData(loaded.pdf, pageNo), rendered = await renderPage(data.page, dpi);
      if (includeImages) data.pageImageBlob = await canvasToPngBlob(rendered.canvas);
      const ocr = await recognizePage(rendered.canvas, rendered.effectiveDpi);
      const page = buildPage(file.name, pageNo, data, rendered, ocr);
      state.pages.push(page);
      const score = getCustomsPageScore(page);
      const record = extractDeclarations(page, file.name)[0] || null;
      if (record && (!best || score > best.score)) best = { record, score };
      rendered.canvas.width = 1; rendered.canvas.height = 1;
      renderResults(state);
    }
    if (best) state.declarations.push(best.record);
    renderResults(state);
  } finally {
    if (typeof loaded.loadingTask?.destroy === "function") await loaded.loadingTask.destroy().catch(() => {});
    else if (typeof loaded.pdf?.cleanup === "function") await loaded.pdf.cleanup().catch(() => {});
  }
}

function buildPage(fileName, pageNo, data, rendered, ocr) {
  return { sourceFile:fileName, pageNumber:pageNo, widthPt:data.widthPt, heightPt:data.heightPt, rotation:data.rotation,
    renderWidth:rendered.canvas.width, renderHeight:rendered.canvas.height, effectiveDpi:rendered.effectiveDpi,
    nativeText:data.nativeText, nativeItems:data.nativeItems, annotations:data.annotations, operationCount:data.operationCount,
    ocrText:ocr.text, ocrWords:ocr.words, ocrLines:ocr.lines, ocrConfidence:ocr.confidence, pageImageBlob:data.pageImageBlob||null };
}

function handleOcrProgress(m) {
  if (!m?.progress) return;
  const pct = state.progressBase + state.progressSpan * Math.min(0.98, m.progress);
  $("progressBar").value = pct; $("progressText").textContent = `${Math.round(pct)}%`;
  $("detailText").textContent = `${m.status || "OCR"} - ${Math.round(m.progress * 100)}% of current page`;
}

function clearAll() { state.files=[]; resetResults(); $("fileInput").value=""; $("fileName").textContent="No PDF selected"; $("fileSize").textContent=""; clearOutputs(); setProgress(0,"Ready","PDF processing happens locally in this browser."); setBusy(false,false,false); }
function clearOutputs() { $("textOutput").value=""; $("metadataOutput").textContent=""; for (const id of ["declarationsTable","pagesTable","wordsTable","annotationsTable"]) $(id).innerHTML=""; $("statFiles").textContent="0"; $("statPages").textContent="0"; $("statDeclarations").textContent="0"; $("statConfidence").textContent="-"; }
async function waitForLibraries() { const start=Date.now(); while (!globalThis.Tesseract && Date.now()-start<12000) await new Promise(r=>setTimeout(r,100)); if (!globalThis.Tesseract) throw new Error("Tesseract.js could not be loaded. Check the internet connection."); }
function showError(error) { console.error(error); setProgress($("progressBar").value,"Error",error?.message||String(error)); }
function formatBytes(n) { if (!n) return "0 B"; const u=["B","KB","MB","GB"], i=Math.min(u.length-1,Math.floor(Math.log(n)/Math.log(1024))); return `${(n/1024**i).toFixed(i?1:0)} ${u[i]}`; }
