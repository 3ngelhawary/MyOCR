export const $ = id => document.getElementById(id);

export function setProgress(percent, status, detail="") {
  $("progressBar").value=Math.max(0,Math.min(100,percent)); $("progressText").textContent=`${Math.round(percent)}%`;
  $("statusText").textContent=status; if (detail) $("detailText").textContent=detail;
}

export function setBusy(busy, hasFile, hasResults) {
  $("scanButton").disabled=busy||!hasFile; $("stopButton").disabled=!busy; $("clearButton").disabled=busy||!hasFile;
  for (const id of ["exportTxt","exportJson","exportCsv","exportZip"]) $(id).disabled=busy||!hasResults;
  $("exportExcel").disabled=busy||!hasResults||!window.__hasDeclarations;
}

export function renderResults(state) {
  renderDeclarations(state.declarations);
  $("textOutput").value=state.pages.map(p=>`===== ${p.sourceFile} | PAGE ${p.pageNumber} =====\n${p.ocrText||p.nativeText||""}`).join("\n\n");
  renderPages(state.pages); renderWords(state.pages); renderAnnotations(state.pages);
  $("metadataOutput").textContent=JSON.stringify(state.documents,null,2);
  const conf=state.pages.filter(p=>p.ocrWords?.length).map(p=>p.ocrConfidence);
  $("statFiles").textContent=state.files.length; $("statPages").textContent=state.pages.length;
  $("statDeclarations").textContent=state.declarations.length; $("statConfidence").textContent=conf.length?`${avg(conf).toFixed(1)}%`:"-";
  window.__hasDeclarations=state.declarations.length>0; $("exportExcel").disabled=state.running||!window.__hasDeclarations;
}

export function initTabs() {
  document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>{
    document.querySelectorAll(".tab,.tab-body").forEach(x=>x.classList.remove("active")); button.classList.add("active"); $("tab-"+button.dataset.tab).classList.add("active");
  }));
}

function renderDeclarations(records) {
  table("declarationsTable",["S/N","Source PDF","Page","Dec. No.","Dec. Date","Value $","Description","OCR Conf."],
    records.map((r,i)=>[i+1,r.sourceFile,r.pageNumber,r.decNo,r.decDate,r.value,r.description,`${r.ocrConfidence||0}%`]));
}
function renderPages(pages) { table("pagesTable",["File","Page","Size pt","Rotation","DPI","OCR words","Confidence"],pages.map(p=>[p.sourceFile,p.pageNumber,`${p.widthPt} x ${p.heightPt}`,p.rotation,p.effectiveDpi,p.ocrWords?.length||0,`${p.ocrConfidence||0}%`])); }
function renderWords(pages) { const rows=[]; for (const p of pages) for (const w of (p.ocrWords||[])) { rows.push([p.sourceFile,p.pageNumber,w.text,w.confidence,w.left,w.top,w.width,w.height]); if (rows.length>=1500) break; } table("wordsTable",["File","Page","Text","Conf.","Left","Top","Width","Height"],rows); }
function renderAnnotations(pages) { const rows=[]; for (const p of pages) for (const a of (p.annotations||[])) rows.push([p.sourceFile,p.pageNumber,a.subtype||"",a.url||"",a.title||"",a.contents||""]); table("annotationsTable",["File","Page","Type","URL","Title","Contents"],rows); }
function table(id,headers,rows) { const el=$(id); el.innerHTML=`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>`+rows.map(r=>`<tr>${r.map(c=>`<td dir="auto">${esc(c)}</td>`).join("")}</tr>`).join("")+"</tbody>"; }
function esc(v) { return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function avg(values) { return values.reduce((a,b)=>a+b,0)/values.length; }
