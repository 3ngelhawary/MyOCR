import { state, settings, resetResults } from "./state.js?v=1.0.8";
import { ensurePdfEngine } from "./pdf-service.js?v=1.0.8";
import { terminateOcrWorker } from "./ocr-service.js?v=1.0.8";
import { exportDeclarationExcel } from "./excel-export.js?v=1.0.8";
import { exportTxt, exportJson, exportWordsCsv, exportZip } from "./export-service.js?v=1.0.8";
import { $, initTabs, setBusy, setProgress } from "./ui.js?v=1.0.8";
import { renderResults } from "./results-table.js?v=1.0.8";
import { scanFiles } from "./scan-runner.js?v=1.0.8";

initTabs(); wireFileInput(); wireActions(); wireSettings(); setBusy(false, false, false);
window.__appReady = true;

function wireFileInput() {
  const zone = $("dropZone");
  zone.addEventListener("click", () => $("fileInput").click());
  zone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("fileInput").click(); } });
  $("fileInput").addEventListener("change", e => acceptFiles(e.target.files));
  for (const name of ["dragenter", "dragover"]) zone.addEventListener(name, e => { e.preventDefault(); zone.classList.add("drag"); });
  for (const name of ["dragleave", "drop"]) zone.addEventListener(name, e => { e.preventDefault(); zone.classList.remove("drag"); });
  zone.addEventListener("drop", e => acceptFiles(e.dataTransfer.files));
}

function wireActions() {
  $("scanButton").addEventListener("click", scan);
  $("stopButton").addEventListener("click", () => { state.stopRequested = true; $("detailText").textContent = "Stopping after the current page..."; });
  $("clearButton").addEventListener("click", clearAll);
  $("exportExcel").addEventListener("click", () => guard(() => exportDeclarationExcel(state)));
  $("exportTxt").addEventListener("click", () => guard(() => exportTxt(state)));
  $("exportJson").addEventListener("click", () => guard(() => exportJson(state)));
  $("exportCsv").addEventListener("click", () => guard(() => exportWordsCsv(state)));
  $("exportZip").addEventListener("click", () => guard(() => exportZip(state)));
}

function wireSettings() {
  const apply = () => {
    settings.dpi = Number($("dpiSelect").value);
    settings.includeImages = $("includeImages").checked;
    settings.textSource = $("textSource").value;
    settings.decimalMode = $("decimalMode").value;
  };
  for (const id of ["dpiSelect", "includeImages", "textSource", "decimalMode"]) $(id).addEventListener("change", apply);
  apply();
}

function acceptFiles(fileList) {
  const files = [...(fileList || [])].filter(f => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
  if (!files.length) return showError(new Error("Please select one or more PDF files."));
  resetResults(); state.files = files; clearOutputs();
  $("fileName").textContent = files.length === 1 ? files[0].name : `${files.length} PDF files selected`;
  $("fileSize").textContent = formatBytes(files.reduce((n, f) => n + f.size, 0));
  setProgress(0, "Ready", "Digital PDFs are read from their text layer; scanned PDFs get a fresh isolated OCR worker.");
  setBusy(false, true, false);
}

async function scan() {
  if (!state.files.length || state.running) return;
  state.running = true; state.stopRequested = false; state.startedAt = new Date().toISOString();
  state.pages = []; state.declarations = []; state.documents = []; state.failures = [];
  setBusy(true, true, false);
  try {
    await ensurePdfEngine();
    await scanFiles(state, settings);
    state.completedAt = new Date().toISOString();
    setProgress(state.stopRequested ? Number($("progressBar").value) : 100, state.stopRequested ? "Stopped" : "Completed", summaryLine());
  } catch (error) { showError(error); }
  finally {
    await terminateOcrWorker();
    state.running = false;
    renderResults(state);
    setBusy(false, true, state.pages.length > 0);
  }
}

function summaryLine() {
  const failed = state.failures.length ? ` ${state.failures.length} PDF(s) were skipped - see the Failures list.` : "";
  return `Produced ${state.declarations.length} declaration record(s) from ${state.pages.length} page(s).${failed} Cells in the Declarations tab can be edited before export.`;
}

async function guard(action) { try { await action(); } catch (error) { showError(error); } }

function clearAll() {
  state.files = []; resetResults(); $("fileInput").value = "";
  $("fileName").textContent = "No PDF selected"; $("fileSize").textContent = "";
  clearOutputs(); setProgress(0, "Ready", "PDF processing happens locally in this browser."); setBusy(false, false, false);
}

function clearOutputs() {
  $("textOutput").value = ""; $("metadataOutput").textContent = "";
  for (const id of ["declarationsTable", "pagesTable", "wordsTable", "annotationsTable", "failuresTable"]) $(id).innerHTML = "";
  $("failuresPanel").hidden = true;
  for (const id of ["statFiles", "statPages", "statDeclarations", "statNative", "statFailed"]) $(id).textContent = "0";
  $("statConfidence").textContent = "-";
}

function showError(error) { console.error(error); setProgress(Number($("progressBar").value), "Error", error?.message || String(error)); }

function formatBytes(n) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"], i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}
