export const $ = (id) => document.getElementById(id);

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
  for (const id of ["exportTxt", "exportJson", "exportCsv", "exportZip"]) {
    $(id).disabled = busy || !hasResults;
  }
}

export function renderResults(state) {
  const allText = state.pages.map((p) => `===== PAGE ${p.pageNumber} =====\n${p.ocrText || p.nativeText || ""}`).join("\n\n");
  $("textOutput").value = allText;
  renderPages(state.pages);
  renderWords(state.pages);
  renderAnnotations(state.pages);
  $("metadataOutput").textContent = JSON.stringify({ metadata: state.metadata, outline: state.outline }, null, 2);
  const words = state.pages.flatMap((p) => p.ocrWords || []);
  const nativeChars = state.pages.reduce((n, p) => n + (p.nativeText?.length || 0), 0);
  const conf = state.pages.filter((p) => p.ocrWords?.length).map((p) => p.ocrConfidence);
  $("statPages").textContent = state.pages.length;
  $("statWords").textContent = words.length.toLocaleString();
  $("statNative").textContent = nativeChars.toLocaleString();
  $("statConfidence").textContent = conf.length ? `${avg(conf).toFixed(1)}%` : "-";
}

export function initTabs() {
  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
    document.querySelectorAll(".tab,.tab-body").forEach((x) => x.classList.remove("active"));
    button.classList.add("active");
    $("tab-" + button.dataset.tab).classList.add("active");
  }));
}

function renderPages(pages) {
  table("pagesTable", ["Page", "Size pt", "Rotation", "DPI", "Native chars", "OCR words", "Confidence", "Operators"],
    pages.map((p) => [p.pageNumber, `${p.widthPt} x ${p.heightPt}`, p.rotation, p.effectiveDpi,
      p.nativeText?.length || 0, p.ocrWords?.length || 0, `${p.ocrConfidence || 0}%`, p.operationCount]));
}

function renderWords(pages) {
  const rows = [];
  for (const p of pages) for (const w of (p.ocrWords || [])) {
    rows.push([p.pageNumber, w.text, w.confidence, w.left, w.top, w.width, w.height, w.block, w.line]);
    if (rows.length >= 1500) break;
  }
  table("wordsTable", ["Page", "Text", "Conf.", "Left", "Top", "Width", "Height", "Block", "Line"], rows);
}

function renderAnnotations(pages) {
  const rows = [];
  for (const p of pages) for (const a of (p.annotations || [])) {
    rows.push([p.pageNumber, a.subtype || "", a.url || "", a.title || "", a.contents || ""]);
  }
  table("annotationsTable", ["Page", "Type", "URL", "Title", "Contents"], rows);
}

function table(id, headers, rows) {
  const el = $(id);
  el.innerHTML = `<thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
    rows.map((r) => `<tr>${r.map((c) => `<td dir="auto">${esc(c)}</td>`).join("")}</tr>`).join("") + "</tbody>";
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

function avg(values) { return values.reduce((a, b) => a + b, 0) / values.length; }
