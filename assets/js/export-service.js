const FIELDS = ["decNo", "decDate", "shahadaNo", "kasimaNo", "kasimaDate", "value", "description",
  "invoiceNo", "packages", "grossWeight", "currency"];
const HEADERS = ["S/N", "Source PDF", "Page", "Text source", "Dec. No.", "Dec. Date", "Shahada No.", "Kasima No.",
  "Kasima Date", "Value", "Description", "Invoice No.", "Packages", "Gross Wt.", "Currency", "OCR Conf.", "Flags", "Edited"];

export function exportTxt(state) { download(textBlob(fullText(state)), "PDF_Declaration_Extraction_text.txt"); }

export function exportJson(state) {
  download(new Blob([JSON.stringify(serializableState(state), null, 2)], { type: "application/json;charset=utf-8" }),
    "PDF_Declaration_Extraction_data.json");
}

export function exportWordsCsv(state) { download(csvBlob(wordRows(state.pages, true)), "PDF_Declaration_Extraction_ocr_words.csv"); }

export async function exportZip(state) {
  if (!globalThis.JSZip) throw new Error("JSZip failed to load.");
  const zip = new JSZip(), root = zip.folder("PDF_Declaration_Extraction");
  root.file("summary.json", JSON.stringify(summary(state), null, 2));
  root.file("declarations.csv", withBom(toCsv(declarationRows(state.declarations))));
  root.file("full_text.txt", withBom(fullText(state)));
  root.file("ocr_words.csv", withBom(toCsv(wordRows(state.pages, false))));
  if (state.failures.length) root.file("failures.csv", withBom(toCsv([["PDF", "Reason"], ...state.failures.map(f => [f.fileName, f.message])])));
  for (const p of state.pages) if (p.pageImageBlob) root.folder(safe(p.sourceFile)).file(`page_${String(p.pageNumber).padStart(4, "0")}.png`, p.pageImageBlob);
  download(await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }), "PDF_Declaration_Extraction_complete.zip");
}

export function declarationRows(records) {
  return [HEADERS].concat(records.map((r, i) => [i + 1, r.sourceFile, r.pageNumber, r.textSource,
    ...FIELDS.map(k => r[k] ?? ""), r.ocrConfidence, (r.flags || []).join(" "), r.edited ? "yes" : ""]));
}

function fullText(state) {
  return state.pages.map(p => `===== ${p.sourceFile} | PAGE ${p.pageNumber} | ${String(p.textSource || "ocr").toUpperCase()} =====\n${p.ocrText || p.nativeText || ""}`).join("\n\n");
}

function serializableState(state) {
  return { sourceFiles: state.files.map(f => ({ name: f.name, size: f.size })), startedAt: state.startedAt, completedAt: state.completedAt,
    documents: state.documents, declarations: state.declarations, failures: state.failures,
    pages: state.pages.map(({ pageImageBlob, ...p }) => p) };
}

function summary(state) {
  const words = state.pages.flatMap(p => p.ocrWords || []);
  return { sourceFiles: state.files.map(f => f.name), pageCount: state.pages.length, declarationCount: state.declarations.length,
    nativeTextPages: state.pages.filter(p => p.textSource === "native").length, failedFiles: state.failures,
    wordCount: words.length, averageConfidence: avg(words.map(w => w.confidence).filter(x => x >= 0)), ocrLanguages: ["ara", "eng"] };
}

function wordRows(pages, extended) {
  const head = ["File", "Page", "Source", "Text", "Confidence", "Left", "Top", "Width", "Height"];
  const rows = [extended ? [...head, "Block", "Paragraph", "Line", "Word"] : head];
  for (const p of pages) for (const w of (p.ocrWords || [])) {
    const base = [p.sourceFile, p.pageNumber, p.textSource, w.text, w.confidence, w.left, w.top, w.width, w.height];
    rows.push(extended ? [...base, w.block, w.paragraph, w.line, w.word] : base);
  }
  return rows;
}

function csvBlob(rows) { return new Blob([withBom(toCsv(rows))], { type: "text/csv;charset=utf-8" }); }
function textBlob(text) { return new Blob([withBom(text)], { type: "text/plain;charset=utf-8" }); }
function withBom(text) { return "\uFEFF" + text; }
function toCsv(rows) { return rows.map(r => r.map(csvCell).join(",")).join("\r\n"); }
function csvCell(v) { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function safe(name) { return String(name || "pdf").replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "_"); }
function avg(v) { return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : 0; }
function download(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
