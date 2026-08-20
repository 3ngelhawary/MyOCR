export function exportTxt(state) {
  const text=state.pages.map(p=>`===== ${p.sourceFile} | PAGE ${p.pageNumber} =====\n${p.ocrText||p.nativeText||""}`).join("\n\n");
  download(textBlob(text),"PDF_Declaration_Extraction_text.txt");
}
export function exportJson(state) { download(new Blob([JSON.stringify(serializableState(state),null,2)],{type:"application/json;charset=utf-8"}),"PDF_Declaration_Extraction_data.json"); }
export function exportWordsCsv(state) {
  const rows=[["File","Page","Text","Confidence","Left","Top","Width","Height","Block","Paragraph","Line","Word"]];
  for (const p of state.pages) for (const w of (p.ocrWords||[])) rows.push([p.sourceFile,p.pageNumber,w.text,w.confidence,w.left,w.top,w.width,w.height,w.block,w.paragraph,w.line,w.word]);
  download(csvBlob(rows),"PDF_Declaration_Extraction_ocr_words.csv");
}
export async function exportZip(state) {
  if (!globalThis.JSZip) throw new Error("JSZip failed to load.");
  const zip=new JSZip(), root=zip.folder("PDF_Declaration_Extraction");
  root.file("summary.json",JSON.stringify(summary(state),null,2));
  root.file("declarations.csv",withBom(toCsv(declarationRows(state.declarations))));
  root.file("full_text.txt",withBom(state.pages.map(p=>`===== ${p.sourceFile} | PAGE ${p.pageNumber} =====\n${p.ocrText||p.nativeText||""}`).join("\n\n")));
  root.file("ocr_words.csv",withBom(toCsv(wordRows(state.pages))));
  for (const p of state.pages) if (p.pageImageBlob) root.folder(safe(p.sourceFile)).file(`page_${String(p.pageNumber).padStart(4,"0")}.png`,p.pageImageBlob);
  download(await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}}),"PDF_Declaration_Extraction_complete.zip");
}
function serializableState(state) { return { sourceFiles:state.files.map(f=>({name:f.name,size:f.size})),startedAt:state.startedAt,completedAt:state.completedAt,documents:state.documents,declarations:state.declarations,pages:state.pages.map(({pageImageBlob,...p})=>p) }; }
function summary(state) { const words=state.pages.flatMap(p=>p.ocrWords||[]); return { sourceFiles:state.files.map(f=>f.name),pageCount:state.pages.length,declarationCount:state.declarations.length,ocrWordCount:words.length,averageConfidence:avg(words.map(w=>w.confidence).filter(x=>x>=0)),ocrLanguages:["ara","eng"] }; }
function declarationRows(records) { return [["S/N","Source PDF","Page","Dec. No.","Dec. Date","Value","Description"]].concat(records.map((r,i)=>[i+1,r.sourceFile,r.pageNumber,r.decNo,r.decDate,r.value,r.description])); }
function wordRows(pages) { const rows=[["File","Page","Text","Confidence","Left","Top","Width","Height"]]; for (const p of pages) for (const w of (p.ocrWords||[])) rows.push([p.sourceFile,p.pageNumber,w.text,w.confidence,w.left,w.top,w.width,w.height]); return rows; }
function csvBlob(rows){return new Blob([withBom(toCsv(rows))],{type:"text/csv;charset=utf-8"});} function textBlob(text){return new Blob([withBom(text)],{type:"text/plain;charset=utf-8"});}
function withBom(text){return "\uFEFF"+text;} function toCsv(rows){return rows.map(r=>r.map(csvCell).join(",")).join("\r\n");} function csvCell(v){const s=String(v??"");return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function safe(name){return String(name||"pdf").replace(/\.pdf$/i,"").replace(/[\\/:*?"<>|]+/g,"_");} function avg(v){return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10:0;}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
