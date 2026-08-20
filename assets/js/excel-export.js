const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const TEMPLATE = new URL("../templates/declaration-template.xlsx", import.meta.url);

export async function exportDeclarationExcel(state) {
  if (!globalThis.JSZip) throw new Error("JSZip failed to load.");
  if (!state.declarations.length) throw new Error("No declarations were detected to export.");
  const response = await fetch(TEMPLATE);
  if (!response.ok) throw new Error("Excel template could not be loaded.");
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const path = "xl/worksheets/sheet1.xml";
  const xml = await zip.file(path).async("string");
  zip.file(path, buildDeclarationSheetXml(xml, state.declarations));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  download(blob, `Declaration_Extraction_${dateStamp()}.xlsx`);
}

export function buildDeclarationSheetXml(xmlText, records) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const sheetData = doc.getElementsByTagNameNS(NS, "sheetData")[0];
  const rows = [...sheetData.getElementsByTagNameNS(NS, "row")];
  const row3 = rows.find(r => r.getAttribute("r") === "3").cloneNode(true);
  const row4 = rows.find(r => r.getAttribute("r") === "4").cloneNode(true);
  rows.filter(r => Number(r.getAttribute("r")) >= 3).forEach(r => r.remove());
  records.forEach((record, i) => {
    const top = 3 + i * 2, bottom = top + 1;
    const a = cloneRow(row3, top), b = cloneRow(row4, bottom);
    clearRow(a); clearRow(b);
    setCell(a, "A", top, String(i + 1), true);
    setCell(a, "B", top, record.decNo || "");
    setCell(b, "B", bottom, record.decDate || "");
    setCell(a, "E", top, record.value || "", true);
    setCell(a, "F", top, record.description || "");
    sheetData.appendChild(a); sheetData.appendChild(b);
  });
  updateMerges(doc, records.length);
  const dimension = doc.getElementsByTagNameNS(NS, "dimension")[0];
  dimension?.setAttribute("ref", `A1:K${Math.max(2, records.length * 2 + 2)}`);
  return new XMLSerializer().serializeToString(doc);
}

function cloneRow(template, rowNo) {
  const row = template.cloneNode(true); row.setAttribute("r", String(rowNo));
  [...row.getElementsByTagNameNS(NS, "c")].forEach(c => {
    const col = (c.getAttribute("r") || "A1").replace(/\d+/g, "");
    c.setAttribute("r", `${col}${rowNo}`);
  });
  return row;
}

function clearRow(row) {
  [...row.getElementsByTagNameNS(NS, "c")].forEach(c => {
    [...c.childNodes].forEach(n => { if (n.nodeType === 1 && ["v","is","f"].includes(n.localName)) n.remove(); });
    c.removeAttribute("t");
  });
}

function setCell(row, col, rowNo, value, numeric = false) {
  const cell = [...row.getElementsByTagNameNS(NS, "c")].find(c => c.getAttribute("r") === `${col}${rowNo}`);
  if (!cell || value === "") return;
  const number = numeric ? Number(String(value).replace(/,/g, "")) : NaN;
  if (numeric && Number.isFinite(number)) {
    const v = row.ownerDocument.createElementNS(NS, "v"); v.textContent = String(number); cell.appendChild(v); return;
  }
  cell.setAttribute("t", "inlineStr");
  const is = row.ownerDocument.createElementNS(NS, "is"), t = row.ownerDocument.createElementNS(NS, "t");
  t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve"); t.textContent = String(value); is.appendChild(t); cell.appendChild(is);
}

function updateMerges(doc, count) {
  const mergeCells = doc.getElementsByTagNameNS(NS, "mergeCells")[0];
  [...mergeCells.getElementsByTagNameNS(NS, "mergeCell")]
    .filter(m => /(?:^|:)[A-K](?:[3-9]|\d{2,})/.test(m.getAttribute("ref") || "")).forEach(m => m.remove());
  const pairs = ["A","E","F","G","H","K"];
  for (let i = 0; i < count; i++) {
    const top = 3 + i * 2, bottom = top + 1;
    for (const col of pairs) {
      const m = doc.createElementNS(NS, "mergeCell"); m.setAttribute("ref", `${col}${top}:${col}${bottom}`); mergeCells.appendChild(m);
    }
  }
  mergeCells.setAttribute("count", String(mergeCells.getElementsByTagNameNS(NS, "mergeCell").length));
}

function dateStamp() { return new Date().toISOString().slice(0, 10); }
function download(blob, name) { const u=URL.createObjectURL(blob), a=document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000); }
