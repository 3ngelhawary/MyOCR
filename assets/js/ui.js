import { state } from "./state.js?v=1.0.8";

export const $ = id => document.getElementById(id);

export function setProgress(percent, status, detail = "") {
  $("progressBar").value = Math.max(0, Math.min(100, percent));
  $("progressText").textContent = `${Math.round(percent)}%`;
  $("statusText").textContent = status;
  if (detail) $("detailText").textContent = detail;
}

export function setBusy(busy, hasFile, hasResults) {
  $("scanButton").disabled = busy || !hasFile;
  $("stopButton").disabled = !busy;
  $("clearButton").disabled = busy || !hasFile;
  for (const id of ["exportTxt", "exportJson", "exportCsv", "exportZip"]) $(id).disabled = busy || !hasResults;
  $("exportExcel").disabled = busy || !hasResults || !state.declarations.length;
}

export function reportOcrProgress(message) {
  if (!message?.progress) return;
  const pct = state.progressBase + state.progressSpan * Math.min(0.98, message.progress);
  $("progressBar").value = pct;
  $("progressText").textContent = `${Math.round(pct)}%`;
  $("detailText").textContent = `${message.status || "OCR"} - ${Math.round(message.progress * 100)}% of current page`;
}

export function initTabs() {
  document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".tab,.tab-body").forEach(x => x.classList.remove("active"));
    button.classList.add("active");
    $("tab-" + button.dataset.tab).classList.add("active");
  }));
}

export function renderStats(state) {
  const scored = state.pages.filter(p => p.textSource === "ocr" && p.ocrWords?.length).map(p => p.ocrConfidence);
  const nativePages = state.pages.filter(p => p.textSource === "native").length;
  $("statFiles").textContent = state.documents.length;
  $("statPages").textContent = state.pages.length;
  $("statDeclarations").textContent = state.declarations.length;
  $("statNative").textContent = nativePages;
  $("statFailed").textContent = state.failures.length;
  $("statConfidence").textContent = scored.length ? `${avg(scored).toFixed(1)}%` : (nativePages ? "text layer" : "-");
}

export function table(id, headers, rows) {
  $(id).innerHTML = `<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
    rows.map(r => `<tr>${r.map(c => `<td dir="auto">${esc(c)}</td>`).join("")}</tr>`).join("") + "</tbody>";
}

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
}

export function avg(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
