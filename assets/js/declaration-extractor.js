const DEC_RE = /(?:[\p{L}\p{N}_ -]{1,30}\.\s*\/\s*)?\d{3,5}\s*\/\s*(?:19|20)\d{2}/gu;
const DATE_RE = /\b(?:0?[1-9]|[12]\d|3[01])\s*[\/.\-]\s*(?:0?[1-9]|1[0-2])\s*[\/.\-]\s*(?:19|20)\d{2}\b/g;
const MONEY_RE = /(?:[$€£]\s*)?\d[\d,]*(?:\.\d{1,3})?/g;
const IGNORE_DESC_RE = /details?\s+as\s+per\s+inv(?:oice)?\s*['’]?s?\s*\.?\s*att\.?/ig;

export function isCustomsPage(page) {
  const text = normalizeText(`${page.ocrText || ""} ${page.nativeText || ""}`);
  return /\bcustoms?\b/i.test(text) || /جمرك/.test(text);
}

export function extractDeclarations(page, sourceFile) {
  const words = page.ocrWords || [], lines = makeLines(words);
  const text = normalizeText(page.ocrText || page.nativeText || "");
  const dec = findDeclarationNumber(lines, text);
  const description = findDescription(words, lines, page);
  const value = findValue(words, lines, page);
  if (!dec && !description && !value) return [];
  return [{ sourceFile, pageNumber: page.pageNumber, decNo: dec?.value || "",
    decDate: findDeclarationDate(dec?.line, lines, text), description, value,
    ocrConfidence: page.ocrConfidence || 0 }];
}

export function normalizeDigits(value) {
  const ar = "٠١٢٣٤٥٦٧٨٩", fa = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "").replace(/[٠-٩]/g, c => ar.indexOf(c)).replace(/[۰-۹]/g, c => fa.indexOf(c));
}

function findDeclarationNumber(lines, text) {
  const candidates = [];
  lines.forEach((line, i) => {
    for (const raw of normalizeDigits(line.text).match(DEC_RE) || []) {
      if (isInvoiceLine(line.text) || nearbyInvoiceLabel(lines, i)) continue;
      let score = 1000 + i;
      if (hasDecLabel(line.text)) score -= 900;
      for (let d = 1; d <= 2; d++) if (lines[i - d] && hasDecLabel(lines[i - d].text)) score -= 650 / d;
      candidates.push({ value: cleanDecNo(raw), line, score });
    }
  });
  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length) return candidates[0];
  const fallback = (text.match(DEC_RE) || []).map(cleanDecNo);
  return fallback.length === 1 && !/invoice|\binv\.?\b/i.test(text) ? { value: fallback[0], line: null } : null;
}

function findDeclarationDate(decLine, lines, text) {
  const candidates = [];
  lines.forEach((line, i) => {
    if (isInvoiceLine(line.text) || nearbyInvoiceLabel(lines, i)) return;
    for (const raw of normalizeDigits(line.text).match(DATE_RE) || []) candidates.push({ date: cleanDate(raw), line });
  });
  if (!candidates.length) return cleanDate((text.match(DATE_RE) || [""])[0]);
  if (!decLine) return candidates[0].date;
  candidates.sort((a, b) => lineDistance(decLine, a.line) - lineDistance(decLine, b.line));
  return candidates[0].date;
}

function findValue(words, lines, page) {
  const label = words.find(w => /^value$/i.test(cleanToken(w.text)));
  if (label) {
    const cx = label.left + label.width / 2, maxY = Math.max(120, (page.renderHeight || 0) * 0.28);
    const maxX = Math.max(100, (page.renderWidth || 0) * 0.12);
    const hits = words.filter(w => w.top >= label.top + label.height * 0.4)
      .map(w => ({ w, raw: moneyToken(w.text) })).filter(x => x.raw)
      .filter(x => Math.abs((x.w.left + x.w.width / 2) - cx) <= maxX && x.w.top - label.top <= maxY)
      .map(x => ({ ...x, score: x.w.top - label.top + Math.abs((x.w.left + x.w.width / 2) - cx) * 0.35 }))
      .sort((a, b) => a.score - b.score);
    if (hits.length) return hits[0].raw;
  }
  const i = lines.findIndex(l => /\bvalue\b/i.test(l.text));
  if (i >= 0) for (const line of lines.slice(i, i + 4)) {
    const values = moneyMatches(line.text.replace(/\bvalue\b/ig, "")); if (values.length) return values[0];
  }
  return "";
}

function findDescription(words, lines, page) {
  const label = words.find(w => isGoodsLabel(w.text));
  if (!label) return findDescriptionByLines(lines);
  const cx = label.left + label.width / 2, halfWidth = Math.max(220, (page.renderWidth || 0) * 0.28);
  const maxY = Math.max(320, (page.renderHeight || 0) * 0.38), selected = [];
  for (const line of lines.filter(l => l.top >= label.top + label.height * 0.5).sort((a,b) => a.top - b.top)) {
    if (line.top - label.top > maxY) break;
    const local = line.words.filter(w => Math.abs((w.left + w.width / 2) - cx) <= halfWidth);
    if (!local.length || local.some(w => isGoodsLabel(w.text))) continue;
    const text = cleanDescription(joinReadingOrder(local));
    if (!text) continue;
    if (isDescriptionStop(text)) break;
    if (selected.length && line.top - selected.at(-1).bottom > Math.max(70, line.height * 3.2)) break;
    selected.push({ text, bottom: line.bottom });
  }
  return selected.map(x => x.text).join(" ").replace(/\s{2,}/g, " ").trim();
}

function findDescriptionByLines(lines) {
  const i = lines.findIndex(l => hasGoodsLabel(l.text)); if (i < 0) return "";
  const out = [];
  for (const line of lines.slice(i + 1, i + 12)) {
    const text = cleanDescription(line.text); if (!text) continue;
    if (isDescriptionStop(text)) break; out.push(text);
  }
  return out.join(" ").trim();
}

function makeLines(words) {
  const map = new Map();
  for (const w of words) { const key = `${w.block}:${w.paragraph}:${w.line}`; if (!map.has(key)) map.set(key, []); map.get(key).push(w); }
  return [...map.values()].map(items => { const left=Math.min(...items.map(w=>w.left)), top=Math.min(...items.map(w=>w.top));
    const right=Math.max(...items.map(w=>w.left+w.width)), bottom=Math.max(...items.map(w=>w.top+w.height));
    return { words:items, text:joinReadingOrder(items), left, top, right, bottom, height:bottom-top }; }).sort((a,b)=>a.top-b.top||a.left-b.left);
}

function joinReadingOrder(words) { const ar=words.reduce((n,w)=>n+((w.text.match(/[\u0600-\u06ff]/g)||[]).length),0), la=words.reduce((n,w)=>n+((w.text.match(/[A-Za-z]/g)||[]).length),0); return [...words].sort((a,b)=>ar>la?b.left-a.left:a.left-b.left).map(w=>w.text).join(" "); }
function hasDecLabel(t) { return /\bdec(?:laration)?\s*\.?\s*(?:no|number)\b/i.test(t) || /رقم\s*(?:البيان|البيان\s*الجمركي|التصريح)/.test(arabicClean(t)); }
function isInvoiceLine(t) { return /\binvoice\b|\binv\.?\s*(?:no|number|#)?\b/i.test(t); }
function nearbyInvoiceLabel(lines, i) { return [i-1,i].some(n => n >= 0 && isInvoiceLine(lines[n].text)); }
function isGoodsLabel(t) { const x=arabicClean(cleanToken(t)); return x==="goods"||x==="good"||x.includes("الطرود")||x==="طرود"; }
function hasGoodsLabel(t) { return String(t).split(/\s+/).some(isGoodsLabel); }
function isDescriptionStop(t) { return /\b(value|date|declaration|dec\.?\s*no|weight|invoice|currency|origin|total)\b/i.test(t) || /القيمه|القيمة|الوزن|الفاتوره|الفاتورة|التاريخ|رقم\s*البيان/.test(arabicClean(t)); }
function cleanDescription(t) { return String(t||"").replace(IGNORE_DESC_RE," ").replace(/\s{2,}/g," ").trim(); }
function moneyMatches(t) { return (normalizeDigits(t).match(MONEY_RE)||[]).map(moneyToken).filter(Boolean); }
function moneyToken(t) { const m=normalizeDigits(t).replace(/\s/g,"").match(/(?:[$€£])?(\d[\d,]*(?:\.\d{1,3})?)/); return m ? m[1].replace(/,/g,"") : ""; }
function cleanToken(t) { return normalizeDigits(t).toLowerCase().replace(/[\u200e\u200f\u202a-\u202e]/g,"").replace(/[\s:;,$€£()[\]{}]/g,"").replace(/ـ/g,""); }
function arabicClean(t) { return String(t).replace(/[إأآ]/g,"ا").replace(/[ًٌٍَُِّْ]/g,""); }
function normalizeText(t) { return normalizeDigits(t).replace(/[\u200e\u200f\u202a-\u202e]/g," "); }
function cleanDecNo(t) { return normalizeDigits(t).replace(/\s+/g,"").replace(/\/{2,}/g,"/"); }
function cleanDate(t) { return normalizeDigits(t).replace(/\s+/g,"").replace(/[.\-]/g,"/"); }
function lineDistance(a,b) { return Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2)+Math.abs((a.left+a.right)/2-(b.left+b.right)/2)*0.12; }
