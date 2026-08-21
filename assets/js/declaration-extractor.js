const DEC_RE = /(?:[\p{L}][\p{L}\p{N}._-]{0,15}\s*\/\s*)?\d{3,5}\s*\/\s*(?:19|20)\d{2}/gu;
const DATE_RE = /\b(?:0?[1-9]|[12]\d|3[01])\s*[\/.\-]\s*(?:0?[1-9]|1[0-2])\s*[\/.\-]\s*(?:19|20)\d{2}\b/g;
const MONEY_RE = /\d[\d,]*(?:\.\d{1,3})?/g;

export function isCustomsPage(page) {
  const text = normalizeText(`${page.ocrText || ""} ${page.nativeText || ""}`);
  return /\bcustoms?\b/i.test(text) || /جمرك/.test(text);
}

export function extractDeclarations(page, sourceFile) {
  const words = page.ocrWords || [], lines = makeLines(words);
  const text = normalizeText(page.ocrText || page.nativeText || "");
  const dec = findDeclarationNumber(lines, text, page);
  const description = findDescription(lines);
  const value = findValue(words, lines);
  if (!dec && !description && !value) return [];
  return [{ sourceFile, pageNumber: page.pageNumber, decNo: dec?.value || "",
    decDate: findDeclarationDate(dec?.line, lines, text), description, value,
    ocrConfidence: page.ocrConfidence || 0 }];
}

export function normalizeDigits(value) {
  const ar = "٠١٢٣٤٥٦٧٨٩", fa = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "").replace(/[٠-٩]/g, c => ar.indexOf(c)).replace(/[۰-۹]/g, c => fa.indexOf(c));
}

function findDeclarationNumber(lines, text, page) {
  const customs = lines.filter(l => hasCustomsLabel(l.text));
  const height = page.renderHeight || Math.max(1, ...lines.map(l => l.bottom));
  const candidates = [];
  lines.forEach((line, i) => {
    for (const raw of normalizeDigits(line.text).match(DEC_RE) || []) {
      if (isInvoiceLine(line.text) || nearbyInvoiceLabel(lines, i)) continue;
      let score = line.top / height * 700;
      if (line.top <= height * 0.35) score -= 350;
      if (hasDecLabel(line.text)) score -= 1000;
      if (/^[A-Za-z\u0600-\u06ff]/.test(cleanDecNo(raw))) score -= 180;
      for (let d = 1; d <= 2; d++) if (lines[i-d] && hasDecLabel(lines[i-d].text)) score -= 600 / d;
      if (customs.length) score += Math.min(...customs.map(c => verticalDistance(c, line))) * 0.8 - 500;
      candidates.push({ value: cleanDecNo(raw), line, score });
    }
  });
  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length) return candidates[0];
  const fallback = (text.match(DEC_RE) || []).map(cleanDecNo);
  return fallback.length === 1 ? { value: fallback[0], line: null } : null;
}

function findDeclarationDate(decLine, lines, text) {
  const candidates = [];
  lines.forEach((line, i) => {
    if (isInvoiceLine(line.text) || nearbyInvoiceLabel(lines, i)) return;
    for (const raw of normalizeDigits(line.text).match(DATE_RE) || []) {
      let score = decLine ? lineDistance(decLine, line) : i * 20;
      if (/\bdate\b/i.test(line.text) || /التاريخ/.test(arabicClean(line.text))) score -= 500;
      candidates.push({ date: cleanDate(raw), score });
    }
  });
  if (candidates.length) return candidates.sort((a,b) => a.score-b.score)[0].date;
  return cleanDate((text.match(DATE_RE) || [""])[0]);
}

function findValue(words, lines) {
  const valueLines = lines.filter(l => hasValueLabel(l.text));
  for (const line of valueLines) {
    const after = line.text.replace(/^.*?\bvalue\b/i, "");
    const direct = pickBestMoney(after);
    if (direct) return direct;
    const cy = (line.top + line.bottom) / 2, tolerance = Math.max(28, line.height * 1.3);
    const band = words.filter(w => Math.abs((w.top + w.height / 2) - cy) <= tolerance)
      .sort((a,b) => a.left-b.left).map(w => w.text).join(" ");
    const amount = pickBestMoney(band.replace(/^.*?\bvalue\b/i, ""));
    if (amount) return amount;
  }
  return "";
}

function findDescription(lines) {
  const goodsIndex = lines.findIndex(l => hasGoodsLabel(l.text));
  if (goodsIndex < 0) return "";
  const out = [];
  for (const line of lines.slice(goodsIndex + 1, goodsIndex + 16)) {
    const raw = normalizeText(line.text).trim();
    if (!raw) continue;
    if (hasValueLabel(raw) || isDescriptionStop(raw)) break;
    if (isIgnoredDescriptionLine(raw)) continue;
    const text = cleanDescription(raw);
    if (text) out.push(text);
  }
  return cleanDescription(out.join(" "));
}

function pickBestMoney(text) {
  const values = (normalizeDigits(text).match(MONEY_RE) || []).map(raw => ({ raw: raw.replace(/,/g,""),
    decimal: /\.\d{1,3}$/.test(raw), digits: (raw.match(/\d/g) || []).length }));
  values.sort((a,b) => Number(b.decimal)-Number(a.decimal) || b.digits-a.digits);
  return values[0]?.raw || "";
}

function makeLines(words) {
  const map = new Map();
  for (const w of words) { const key=`${w.block}:${w.paragraph}:${w.line}`; if (!map.has(key)) map.set(key,[]); map.get(key).push(w); }
  return [...map.values()].map(items => { const left=Math.min(...items.map(w=>w.left)), top=Math.min(...items.map(w=>w.top));
    const right=Math.max(...items.map(w=>w.left+w.width)), bottom=Math.max(...items.map(w=>w.top+w.height));
    return { words:items, text:joinReadingOrder(items), left, top, right, bottom, height:bottom-top }; }).sort((a,b)=>a.top-b.top||a.left-b.left);
}

function joinReadingOrder(words) { const ar=words.reduce((n,w)=>n+((w.text.match(/[\u0600-\u06ff]/g)||[]).length),0), la=words.reduce((n,w)=>n+((w.text.match(/[A-Za-z]/g)||[]).length),0); return [...words].sort((a,b)=>ar>la?b.left-a.left:a.left-b.left).map(w=>w.text).join(" "); }
function hasCustomsLabel(t) { return /\bcustoms?\b/i.test(t) || /جمرك/.test(arabicClean(t)); }
function hasDecLabel(t) { return /\b(?:customs?\s+)?dec(?:laration)?\s*\.?\s*(?:no|number)\b/i.test(t) || /رقم\s*(?:البيان|البيان\s*الجمركي|التصريح)/.test(arabicClean(t)); }
function isInvoiceLine(t) { return /\binvoices?\b|\binv\.?\s*['’]?s?\s*(?:no|number|#)?\b/i.test(t); }
function nearbyInvoiceLabel(lines,i) { return [i-1,i,i+1].some(n => n>=0 && n<lines.length && isInvoiceLine(lines[n].text)); }
function hasGoodsLabel(t) { const x=arabicClean(t); return /\b(?:description\s+of\s+)?goods?\b/i.test(x) || /الطرود|طرود/.test(x); }
function hasValueLabel(t) { return /\bvalue\b/i.test(t) || /القيمه|القيمة/.test(arabicClean(t)); }
function isDescriptionStop(t) { return /\b(date|declaration|dec\.?\s*no|weight|invoice|currency|origin|total|supplier|p\.?\s*order)\b/i.test(t) || /القيمه|القيمة|الوزن|الفاتوره|الفاتورة|التاريخ|رقم\s*البيان|المورد/.test(arabicClean(t)); }
function isIgnoredDescriptionLine(t) { return /details?\s+as\s+per/i.test(t) || /inv(?:oice)?\.?\s*['’]?\s*s?\s*\.?\s*att/i.test(t); }
function cleanDescription(t) { let x=String(t||""); const i=x.search(/details?\s+as\s+per\b/i); if(i>=0)x=x.slice(0,i); return x.replace(/\s+\)/g,")").replace(/\s{2,}/g," ").trim(); }
function normalizeText(t) { return normalizeDigits(t).replace(/[\u200e\u200f\u202a-\u202e]/g," "); }
function arabicClean(t) { return String(t).replace(/[إأآ]/g,"ا").replace(/[ًٌٍَُِّْ]/g,""); }
function cleanDecNo(t) { return normalizeDigits(t).replace(/\s+/g,"").replace(/\/{2,}/g,"/"); }
function cleanDate(t) { return normalizeDigits(t).replace(/\s+/g,"").replace(/[.\-]/g,"/"); }
function verticalDistance(a,b) { return Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2); }
function lineDistance(a,b) { return verticalDistance(a,b)+Math.abs((a.left+a.right)/2-(b.left+b.right)/2)*0.12; }
