export function exportTxt(state) {
  const text = state.pages.map((p) => `===== PAGE ${p.pageNumber} =====\n${p.ocrText || p.nativeText || ""}`).join("\n\n");
  download(textBlob(text), baseName(state.file.name) + "_text.txt");
}

export function exportJson(state) {
  const payload = serializableState(state);
  download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }), baseName(state.file.name) + "_data.json");
}

export function exportWordsCsv(state) {
  const rows = [["Page","Text","Confidence","Left","Top","Width","Height","Block","Paragraph","Line","Word"]];
  for (const p of state.pages) for (const w of (p.ocrWords || [])) {
    rows.push([p.pageNumber,w.text,w.confidence,w.left,w.top,w.width,w.height,w.block,w.paragraph,w.line,w.word]);
  }
  download(csvBlob(rows), baseName(state.file.name) + "_ocr_words.csv");
}

export async function exportZip(state) {
  if (!globalThis.JSZip) throw new Error("JSZip failed to load.");
  const zip = new JSZip();
  const root = zip.folder(baseName(state.file.name) + "_extracted");
  root.file("summary.json", JSON.stringify(summary(state), null, 2));
  root.file("metadata.json", JSON.stringify({ metadata: state.metadata, outline: state.outline }, null, 2));
  root.file("full_text.txt", withBom(state.pages.map((p) => `===== PAGE ${p.pageNumber} =====\n${p.ocrText || p.nativeText || ""}`).join("\n\n")));
  root.file("pages.csv", withBom(toCsv(pageRows(state.pages))));
  root.file("ocr_words.csv", withBom(toCsv(wordRows(state.pages))));
  root.file("annotations.csv", withBom(toCsv(annotationRows(state.pages))));
  root.file("native_text_items.csv", withBom(toCsv(nativeRows(state.pages))));
  for (const p of state.pages) {
    const folder = root.folder(`page_${String(p.pageNumber).padStart(4,"0")}`);
    folder.file("ocr_text.txt", withBom(p.ocrText || ""));
    folder.file("native_text.txt", withBom(p.nativeText || ""));
    folder.file("ocr_lines.json", JSON.stringify(p.ocrLines || [], null, 2));
    if (p.pageImageBlob) folder.file("rendered_page.png", p.pageImageBlob);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  download(blob, baseName(state.file.name) + "_complete.zip");
}

function serializableState(state) {
  return {
    sourceFile: { name: state.file?.name, size: state.file?.size, type: state.file?.type },
    startedAt: state.startedAt, completedAt: state.completedAt,
    metadata: state.metadata, outline: state.outline,
    pages: state.pages.map(({ pageImageBlob, ...p }) => p)
  };
}

function summary(state) {
  const words = state.pages.flatMap((p) => p.ocrWords || []);
  return {
    sourceFile: state.file.name, fileSize: state.file.size, pageCount: state.pages.length,
    ocrWordCount: words.length,
    nativeCharacterCount: state.pages.reduce((n,p) => n + (p.nativeText?.length || 0), 0),
    averageConfidence: avg(words.map((w) => w.confidence).filter((x) => x >= 0)),
    ocrLanguages: ["ara","eng"], startedAt: state.startedAt, completedAt: state.completedAt
  };
}

function pageRows(pages) {
  return [["Page","WidthPt","HeightPt","Rotation","EffectiveDpi","NativeChars","OcrWords","OcrConfidence","OperatorCount"]]
    .concat(pages.map((p) => [p.pageNumber,p.widthPt,p.heightPt,p.rotation,p.effectiveDpi,p.nativeText?.length||0,p.ocrWords?.length||0,p.ocrConfidence||0,p.operationCount||0]));
}
function wordRows(pages) {
  const rows = [["Page","Text","Confidence","Left","Top","Width","Height","Block","Paragraph","Line","Word"]];
  for (const p of pages) for (const w of (p.ocrWords || [])) rows.push([p.pageNumber,w.text,w.confidence,w.left,w.top,w.width,w.height,w.block,w.paragraph,w.line,w.word]);
  return rows;
}
function annotationRows(pages) {
  const rows = [["Page","Subtype","Url","Title","Contents"]];
  for (const p of pages) for (const a of (p.annotations || [])) rows.push([p.pageNumber,a.subtype||"",a.url||"",a.title||"",a.contents||""]);
  return rows;
}
function nativeRows(pages) {
  const rows = [["Page","Text","X","Y","Width","Height","FontName","Direction"]];
  for (const p of pages) for (const x of (p.nativeItems || [])) rows.push([p.pageNumber,x.text,x.x,x.y,x.width,x.height,x.fontName,x.dir]);
  return rows;
}
function csvBlob(rows) { return new Blob([withBom(toCsv(rows))], { type: "text/csv;charset=utf-8" }); }
function textBlob(text) { return new Blob([withBom(text)], { type: "text/plain;charset=utf-8" }); }
function withBom(text) { return "\uFEFF" + text; }
function toCsv(rows) { return rows.map((r) => r.map(csvCell).join(",")).join("\r\n"); }
function csvCell(v) { const s=String(v??""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }
function baseName(name) { return String(name || "pdf").replace(/\.pdf$/i, "").replace(/[\\/:*?"<>|]+/g, "_"); }
function avg(v) { return v.length ? Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10 : 0; }
function download(blob, name) { const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000); }
