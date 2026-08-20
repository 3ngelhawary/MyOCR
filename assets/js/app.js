import { state, resetResults } from "./state.js";
import { loadPdf, extractPageData, renderPage, canvasToPngBlob } from "./pdf-service.js";
import { createOcrWorker, recognizePage, terminateOcrWorker } from "./ocr-service.js";
import { $, initTabs, renderResults, setBusy, setProgress } from "./ui.js";
import { exportTxt, exportJson, exportWordsCsv, exportZip } from "./export-service.js";

initTabs();
wireFileInput();
wireActions();
setBusy(false, false, false);

function wireFileInput() {
  const zone = $("dropZone");
  zone.addEventListener("click", () => $("fileInput").click());
  zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") $("fileInput").click(); });
  $("fileInput").addEventListener("change", (e) => acceptFile(e.target.files?.[0]));
  for (const eventName of ["dragenter","dragover"]) zone.addEventListener(eventName, (e) => { e.preventDefault(); zone.classList.add("drag"); });
  for (const eventName of ["dragleave","drop"]) zone.addEventListener(eventName, (e) => { e.preventDefault(); zone.classList.remove("drag"); });
  zone.addEventListener("drop", (e) => acceptFile(e.dataTransfer.files?.[0]));
}

function wireActions() {
  $("scanButton").addEventListener("click", scan);
  $("stopButton").addEventListener("click", () => { state.stopRequested = true; $("detailText").textContent = "Stopping after the current page..."; });
  $("clearButton").addEventListener("click", clearAll);
  $("exportTxt").addEventListener("click", () => exportTxt(state));
  $("exportJson").addEventListener("click", () => exportJson(state));
  $("exportCsv").addEventListener("click", () => exportWordsCsv(state));
  $("exportZip").addEventListener("click", async () => { try { await exportZip(state); } catch (e) { showError(e); } });
}

function acceptFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".pdf")) return showError(new Error("Please select a PDF file."));
  resetResults();
  state.file = file;
  $("fileName").textContent = file.name;
  $("fileSize").textContent = formatBytes(file.size);
  clearOutputs();
  setProgress(0, "Ready", "Scanned/image PDFs are supported. OCR will run on every page.");
  setBusy(false, true, false);
}

async function scan() {
  if (!state.file || state.running) return;
  state.running = true; state.stopRequested = false; state.pages = []; state.startedAt = new Date().toISOString();
  setBusy(true, true, false);
  const dpi = Number($("dpiSelect").value);
  const includeImages = $("includeImages").checked;
  try {
    await waitForLibraries();
    setProgress(1, "Opening PDF", "Reading document structure locally...");
    const loaded = await loadPdf(state.file);
    state.pdf = loaded.pdf; state.metadata = loaded.metadata; state.outline = loaded.outline;
    await createOcrWorker((m) => handleOcrProgress(m));
    for (let pageNo = 1; pageNo <= state.pdf.numPages; pageNo++) {
      if (state.stopRequested) break;
      const basePct = ((pageNo - 1) / state.pdf.numPages) * 100;
      setProgress(basePct, `Page ${pageNo} of ${state.pdf.numPages}`, "Extracting native PDF data...");
      const data = await extractPageData(state.pdf, pageNo);
      const rendered = await renderPage(data.page, dpi);
      if (includeImages) data.pageImageBlob = await canvasToPngBlob(rendered.canvas);
      setProgress(basePct + 2, `OCR page ${pageNo}`, `Arabic + English OCR at ${rendered.effectiveDpi} DPI...`);
      const ocr = await recognizePage(rendered.canvas, rendered.effectiveDpi);
      state.pages.push({
        pageNumber: pageNo, widthPt: data.widthPt, heightPt: data.heightPt, rotation: data.rotation,
        effectiveDpi: rendered.effectiveDpi, nativeText: data.nativeText, nativeItems: data.nativeItems,
        annotations: data.annotations, operationCount: data.operationCount,
        ocrText: ocr.text, ocrWords: ocr.words, ocrLines: ocr.lines, ocrConfidence: ocr.confidence,
        pageImageBlob: data.pageImageBlob || null
      });
      rendered.canvas.width = 1; rendered.canvas.height = 1;
      renderResults(state);
    }
    state.completedAt = new Date().toISOString();
    const stopped = state.stopRequested;
    setProgress(stopped ? (state.pages.length / state.pdf.numPages) * 100 : 100,
      stopped ? "Stopped" : "Completed",
      stopped ? `Processed ${state.pages.length} pages before stopping.` : `Extracted ${state.pages.length} pages successfully.`);
  } catch (e) {
    showError(e);
  } finally {
    await terminateOcrWorker();
    state.running = false;
    setBusy(false, true, state.pages.length > 0);
  }
}

function handleOcrProgress(m) {
  if (!state.pdf || !m?.progress) return;
  const current = state.pages.length;
  const pct = ((current + Math.min(0.98, m.progress)) / state.pdf.numPages) * 100;
  $("progressBar").value = pct; $("progressText").textContent = `${Math.round(pct)}%`;
  $("detailText").textContent = `${m.status || "OCR"} - ${Math.round(m.progress * 100)}% of current page`;
}

function clearAll() {
  state.file = null; resetResults(); $("fileInput").value = "";
  $("fileName").textContent = "No PDF selected"; $("fileSize").textContent = "";
  clearOutputs(); setProgress(0, "Ready", "PDF processing happens locally in this browser."); setBusy(false, false, false);
}

function clearOutputs() {
  $("textOutput").value = ""; $("metadataOutput").textContent = "";
  for (const id of ["pagesTable","wordsTable","annotationsTable"]) $(id).innerHTML = "";
  $("statPages").textContent="0"; $("statWords").textContent="0"; $("statNative").textContent="0"; $("statConfidence").textContent="-";
}

async function waitForLibraries() {
  const start = Date.now();
  while (!globalThis.Tesseract && Date.now() - start < 12000) await new Promise((r) => setTimeout(r, 100));
  if (!globalThis.Tesseract) throw new Error("Tesseract.js could not be loaded. Check the internet connection.");
}

function showError(error) { console.error(error); setProgress($("progressBar").value, "Error", error?.message || String(error)); }
function formatBytes(n) { if (!n) return "0 B"; const u=["B","KB","MB","GB"]; const i=Math.min(u.length-1,Math.floor(Math.log(n)/Math.log(1024))); return `${(n/1024**i).toFixed(i?1:0)} ${u[i]}`; }
