import { $, table, esc, renderStats } from "./ui.js?v=1.0.8";

const COLUMNS = [
  { key: "decNo", label: "Dec. No.", edit: true },
  { key: "decDate", label: "Dec. Date", edit: true },
  { key: "shahadaNo", label: "Shahada No.", edit: true },
  { key: "kasimaNo", label: "Kasima No.", edit: true },
  { key: "kasimaDate", label: "Kasima Date", edit: true },
  { key: "value", label: "Value $", edit: true },
  { key: "description", label: "Description", edit: true },
  { key: "invoiceNo", label: "Invoice No.", edit: true },
  { key: "packages", label: "Packages", edit: true },
  { key: "grossWeight", label: "Gross Wt.", edit: true },
  { key: "currency", label: "Currency", edit: true }
];

export function renderResults(state) {
  renderDeclarations(state.declarations);
  renderFailures(state.failures);
  $("textOutput").value = state.pages.map(p => `===== ${p.sourceFile} | PAGE ${p.pageNumber} | ${p.textSource.toUpperCase()} =====\n${p.ocrText || p.nativeText || ""}`).join("\n\n");
  table("pagesTable", ["File", "Page", "Source", "Size pt", "Rotation", "DPI", "Words", "Confidence"],
    state.pages.map(p => [p.sourceFile, p.pageNumber, p.textSource, `${p.widthPt} x ${p.heightPt}`, p.rotation, p.effectiveDpi, p.ocrWords?.length || 0, `${p.ocrConfidence || 0}%`]));
  renderWords(state.pages);
  table("annotationsTable", ["File", "Page", "Type", "URL", "Title", "Contents"],
    state.pages.flatMap(p => (p.annotations || []).map(a => [p.sourceFile, p.pageNumber, a.subtype || "", a.url || "", a.title || "", a.contents || ""])));
  $("metadataOutput").textContent = JSON.stringify(state.documents, null, 2);
  renderStats(state);
  $("exportExcel").disabled = state.running || !state.declarations.length;
  wireEditing(state);
}

function renderDeclarations(records) {
  const headers = ["S/N", "Source PDF", "Page", "Src", ...COLUMNS.map(c => c.label), "Conf.", "Flags"];
  const body = records.map((record, i) => {
    const cells = COLUMNS.map(column =>
      `<td dir="auto" class="cell-edit${record[column.key] ? "" : " cell-empty"}" contenteditable="true" data-row="${i}" data-key="${column.key}">${esc(record[column.key] || "")}</td>`).join("");
    const flags = (record.flags || []).map(f => `<span class="flag flag-${esc(f)}">${esc(f)}</span>`).join(" ");
    return `<tr class="${rowClass(record)}"><td>${i + 1}</td><td dir="auto">${esc(record.sourceFile)}</td><td>${record.pageNumber}</td>` +
      `<td>${esc(record.textSource)}</td>${cells}<td>${record.ocrConfidence || 0}%</td><td class="flags">${flags}</td></tr>`;
  }).join("");
  $("declarationsTable").innerHTML = `<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody>`;
}

function rowClass(record) {
  if (record.edited) return "row-edited";
  if ((record.flags || []).some(f => f === "low-confidence" || f === "value-missing" || f === "dec-no-missing")) return "row-warn";
  return "";
}

function wireEditing(state) {
  $("declarationsTable").querySelectorAll(".cell-edit").forEach(cell => {
    cell.addEventListener("blur", () => {
      const record = state.declarations[Number(cell.dataset.row)];
      if (!record) return;
      const value = cell.textContent.trim();
      if (value === (record[cell.dataset.key] || "")) return;
      record[cell.dataset.key] = value;
      record.edited = true;
      record.flags = (record.flags || []).filter(f => f !== "value-missing" && f !== "dec-no-missing" && f !== "description-missing");
      renderResults(state);
    });
  });
}

function renderFailures(failures) {
  $("failuresPanel").hidden = !failures.length;
  table("failuresTable", ["PDF", "Reason"], failures.map(f => [f.fileName, f.message]));
}

function renderWords(pages) {
  const rows = [];
  outer: for (const p of pages) {
    for (const w of (p.ocrWords || [])) {
      rows.push([p.sourceFile, p.pageNumber, w.text, w.confidence, Math.round(w.left), Math.round(w.top), Math.round(w.width), Math.round(w.height)]);
      if (rows.length >= 1500) break outer;
    }
  }
  table("wordsTable", ["File", "Page", "Text", "Conf.", "Left", "Top", "Width", "Height"], rows);
}
