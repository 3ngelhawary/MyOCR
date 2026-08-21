const DEC_RE = /(?:[A-Za-z\u0600-\u06ff][A-Za-z\u0600-\u06ff0-9._-]{0,15}\s*\/\s*)?\d{3,5}\s*\/\s*(?:19|20)\d{2}/g;
const DATE_RE = /\b(?:0?[1-9]|[12]\d|3[01])\s*[\/.\-]\s*(?:0?[1-9]|1[0-2])\s*[\/.\-]\s*(?:19|20)\d{2}\b/g;
const MONEY_RE = /\d[\d,]*(?:[.,]\d{2,3})?/g;

export function getCustomsPageScore(page) {
  const words=page.ocrWords||[], h=page.renderHeight||1;
  const topText=words.length ? joinPageWords(words.filter(w=>w.top<=h*0.32)) : normalizeText(page.ocrText||"").slice(0,1400);
  const ar=arabicClean(topText); let score=0;
  if (/\bcustoms?\s+declaration\b/i.test(topText)) score+=1200;
  else if (/\bcustoms?\b/i.test(topText)) score+=650;
  if (/(?:اقرار|بيان).*جمرك|جمرك.*(?:رقم|بيان)/.test(ar)) score+=1050;
  else if (/جمرك/.test(ar)) score+=450;
  if ((normalizeDigits(topText).match(DEC_RE)||[]).length) score+=500;
  if (/\bdate\b/i.test(topText)||/التاريخ/.test(ar)) score+=120;
  return score;
}

export function isCustomsPage(page) { return getCustomsPageScore(page)>=700; }

export function extractDeclarations(page, sourceFile) {
  if (!isCustomsPage(page)) return [];
  const lines = makeLines(page.ocrWords || []);
  const dec = findDeclarationNumber(lines, page.renderHeight || 1);
  if (!dec) return [];
  return [{ sourceFile, pageNumber: page.pageNumber, decNo: dec.value,
    decDate: findDeclarationDate(dec.line, lines, page.renderHeight || 1),
    description: findDescription(lines), value: findValue(lines),
    ocrConfidence: page.ocrConfidence || 0 }];
}

export function normalizeDigits(value) {
  const ar = "٠١٢٣٤٥٦٧٨٩", fa = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "").replace(/[٠-٩]/g, c => ar.indexOf(c)).replace(/[۰-۹]/g, c => fa.indexOf(c));
}

function findDeclarationNumber(lines, height) {
  const topLimit = height * 0.42, customs = lines.filter(l => hasCustomsLabel(l.text));
  const candidates = [];
  lines.forEach((line, i) => {
    if (line.top > topLimit || isInvoiceLine(line.text) || nearbyInvoiceLabel(lines, i)) return;
    for (const raw of normalizeDigits(line.text).match(DEC_RE) || []) {
      const value = cleanDecNo(raw); let score = line.top;
      if (hasDecLabel(line.text)) score -= 1200;
      if (/^[A-Za-z\u0600-\u06ff]+\//.test(value)) score -= 450;
      for (let d = 1; d <= 2; d++) if (lines[i-d] && hasDecLabel(lines[i-d].text)) score -= 500 / d;
      if (customs.length) score += Math.min(...customs.map(c => verticalDistance(c, line))) * 0.7 - 400;
      candidates.push({ value, line, score });
    }
  });
  return candidates.sort((a,b) => a.score-b.score)[0] || null;
}

function findDeclarationDate(decLine, lines, height) {
  const candidates = [];
  lines.forEach((line, i) => {
    if (line.top > height * 0.45 || isInvoiceLine(line.text) || nearbyInvoiceLabel(lines, i)) return;
    for (const raw of normalizeDigits(line.text).match(DATE_RE) || []) {
      let score = lineDistance(decLine, line);
      if (hasDateLabel(line.text)) score -= 900;
      if (lines[i-1] && hasDateLabel(lines[i-1].text)) score -= 500;
      candidates.push({ date: cleanDate(raw), score });
    }
  });
  return candidates.sort((a,b) => a.score-b.score)[0]?.date || "";
}

function findValue(lines) {
  const labelLines = lines.filter(l => hasValueLabel(l.text));
  for (const line of labelLines) {
    const labelWord = line.words.find(w => /\bvalue\b/i.test(w.text) || /القيمه|القيمة/.test(arabicClean(w.text)));
    const minX = labelWord ? labelWord.left + labelWord.width * 0.7 : line.left;
    const cy = (line.top + line.bottom) / 2, tolerance = Math.max(30, line.height * 1.6);
    const bandWords = lines.filter(x => Math.abs((x.top+x.bottom)/2-cy) <= tolerance).flatMap(x => x.words);
    const rightText = bandWords.filter(w => w.left >= minX).sort((a,b) => a.left-b.left).map(w => w.text).join(" ");
    const amount = pickBestMoney(rightText.replace(/\bvalue\b/i, ""));
    if (amount) return amount;
  }
  return "";
}

function findDescription(lines) {
  const goodsIndex = lines.findIndex(l => hasGoodsLabel(l.text));
  if (goodsIndex < 0) return "";
  const valueLine = lines.slice(goodsIndex + 1).find(l => hasValueLabel(l.text));
  const stopY = valueLine?.top ?? Number.POSITIVE_INFINITY, out = [];
  for (const line of lines.slice(goodsIndex + 1)) {
    if (line.top >= stopY) break;
    const raw = normalizeText(line.text).trim();
    if (!raw) continue;
    const beforeDetails = textBeforeDetails(raw);
    if (beforeDetails !== raw) { const text=cleanDescription(beforeDetails); if (text) out.push(text); break; }
    if (isDescriptionStop(raw)) break;
    const text = cleanDescription(raw);
    if (text) out.push(text);
  }
  return cleanDescription(out.join(" "));
}

function pickBestMoney(text) {
  const values = (normalizeDigits(text).match(MONEY_RE) || []).map(raw => {
    let value = raw.replace(/,/g, "");
    if (!value.includes(".") && /^\d+[.,]\d{2}$/.test(raw)) value = raw.replace(",", ".");
    return { value, decimal:/[.,]\d{2,3}$/.test(raw), digits:(raw.match(/\d/g)||[]).length };
  }).filter(x => x.digits >= 2);
  values.sort((a,b) => Number(b.decimal)-Number(a.decimal) || b.digits-a.digits);
  return values[0]?.value || "";
}

function makeLines(words) {
  const map = new Map();
  for (const w of words) { const key=`${w.block}:${w.paragraph}:${w.line}`; if (!map.has(key)) map.set(key,[]); map.get(key).push(w); }
  return [...map.values()].map(items => { const left=Math.min(...items.map(w=>w.left)), top=Math.min(...items.map(w=>w.top));
    const right=Math.max(...items.map(w=>w.left+w.width)), bottom=Math.max(...items.map(w=>w.top+w.height));
    return { words:items, text:joinReadingOrder(items), left, top, right, bottom, height:bottom-top }; }).sort((a,b)=>a.top-b.top||a.left-b.left);
}

function joinPageWords(words) { return [...words].sort((a,b)=>a.top-b.top||a.left-b.left).map(w=>w.text).join(" "); }
function joinReadingOrder(words) { const ar=words.reduce((n,w)=>n+((w.text.match(/[\u0600-\u06ff]/g)||[]).length),0), la=words.reduce((n,w)=>n+((w.text.match(/[A-Za-z]/g)||[]).length),0); return [...words].sort((a,b)=>ar>la?b.left-a.left:a.left-b.left).map(w=>w.text).join(" "); }
function hasCustomsLabel(t) { return /\bcustoms?\b/i.test(t) || /جمرك/.test(arabicClean(t)); }
function hasDecLabel(t) { return /\b(?:customs?\s+)?dec(?:laration)?\s*\.?\s*(?:no|number)\b/i.test(t) || /رقم\s*(?:البيان|التصريح)/.test(arabicClean(t)); }
function hasDateLabel(t) { return /\bdate\b/i.test(t) || /التاريخ/.test(arabicClean(t)); }
function isInvoiceLine(t) { return /\binvoices?\b|\binv\.?\s*['’]?s?\s*(?:no|number|#)?\b/i.test(t); }
function nearbyInvoiceLabel(lines,i) { return [i-1,i,i+1].some(n => n>=0 && n<lines.length && isInvoiceLine(lines[n].text)); }
function hasGoodsLabel(t) { const x=arabicClean(t); return /\b(?:description\s+of\s+)?goods?\b/i.test(x) || /الطرود|طرود/.test(x); }
function hasValueLabel(t) { return /\bvalue\b/i.test(t) || /القيمه|القيمة/.test(arabicClean(t)); }
function textBeforeDetails(t) { const x=String(t||""); const i=x.search(/d[e3]ta[i1l]l?s?\s+as\s+per|inv(?:oice)?\.?\s*['’]?s?\s*(?:att|attachment)/i); return i>=0?x.slice(0,i).trim():x; }
function isDescriptionStop(t) { return /\b(weight|invoice|currency|origin|supplier|p\.?\s*order|gross\s*wt)\b/i.test(t) || /الوزن|الفاتوره|الفاتورة|المورد/.test(arabicClean(t)); }
function cleanDescription(t) {
  let x=normalizeText(t).replace(/\s{2,}/g," ").trim();
  x=stripQuantityPrefix(x);
  x=x.replace(/\s*,\s*/g,", ").replace(/\(\s*/g,"( ").replace(/\s*\)/g," )");
  x=repairClosingParenthesis(x);
  return x.replace(/\s{2,}/g," ").trim();
}

function stripQuantityPrefix(t) {
  const colon=t.search(/[:：؛]/);
  if (colon<0 || colon>32) return t;
  const head=t.slice(0,colon).trim(), tail=t.slice(colon+1).trim();
  const unit=/(?:EA|EACH|PCS?|NOS?|UNITS?|PKGS?|CTNS?|BOX(?:ES)?|SETS?|LOTS?|KGS?|KG|[\u0600-\u06ff]{1,3})/i;
  const qty=new RegExp(`^(?:\\d+\\s+){0,3}\\d+(?:[.,]\\d+)?\\s*${unit.source}$`,"i");
  return qty.test(normalizeDigits(head)) && /[A-Za-z\u0600-\u06ff]/.test(tail) ? tail : t;
}
function repairClosingParenthesis(t) { const opens=(t.match(/\(/g)||[]).length, closes=(t.match(/\)/g)||[]).length; return opens>closes && /\(\s*$/.test(t) ? t.replace(/\(\s*$/," )") : t; }
function normalizeText(t) { return normalizeDigits(t).replace(/[\u200e\u200f\u202a-\u202e]/g," "); }
function arabicClean(t) { return String(t).replace(/[إأآ]/g,"ا").replace(/[ًٌٍَُِّْ]/g,""); }
function cleanDecNo(t) { return normalizeDigits(t).replace(/\s+/g,"").replace(/\/{2,}/g,"/"); }
function cleanDate(t) { return normalizeDigits(t).replace(/\s+/g,"").replace(/[.\-]/g,"/"); }
function verticalDistance(a,b) { return Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2); }
function lineDistance(a,b) { return verticalDistance(a,b)+Math.abs((a.left+a.right)/2-(b.left+b.right)/2)*0.12; }
