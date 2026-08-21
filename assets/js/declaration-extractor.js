import { normalizeDigits, normalizeText, arabicClean, hasCustomsLabel, hasDecLabel, hasDateLabel,
  isInvoiceLine, hasGoodsLabel, hasValueLabel, hasFormSignature, textBeforeDetails,
  isDescriptionStop, cleanDescription, cleanDecNo, cleanDate } from "./declaration-text.js?v=1.0.3";

const DEC_RE = /(?:[A-Za-z\u0600-\u06ff][A-Za-z\u0600-\u06ff0-9._-]{0,15}\s*\/\s*)?\d{3,5}\s*\/\s*(?:19|20)\d{2}/g;
const DATE_RE = /\b(?:0?[1-9]|[12]\d|3[01])\s*[\/.\-]\s*(?:0?[1-9]|1[0-2])\s*[\/.\-]\s*(?:19|20)\d{2}\b/g;
const MONEY_RE = /\d[\d,]*(?:[.,]\d{2,3})?/g;

export function getCustomsPageScore(page) {
  const words = page.ocrWords || [], h = page.renderHeight || 1;
  const topText = joinPageWords(words.filter(w => w.top <= h * 0.38));
  const allText = `${page.ocrText || ""} ${joinPageWords(words)}`;
  const topAr = arabicClean(topText), allAr = arabicClean(allText); let score = 0;
  if (/\bcustoms?\s+declaration\b/i.test(topText)) score += 1200;
  else if (/\bcustoms?\b/i.test(topText)) score += 650;
  if (/(?:اقرار|بيان).*جمرك|جمرك.*(?:رقم|بيان)/.test(topAr)) score += 1050;
  else if (/جمرك/.test(topAr)) score += 450;
  if (findDeclarationNumber(makeLines(words), h)) score += 700;
  if ((normalizeDigits(topText).match(DATE_RE) || []).length) score += 150;
  if (hasGoodsLabel(allText)) score += 330;
  if (hasValueLabel(allText)) score += 330;
  if (hasFormSignature(allText) || /الفاتور/.test(allAr)) score += 180;
  return score;
}

export function extractDeclaration(page, sourceFile) {
  const lines = makeLines(page.ocrWords || []);
  const headerLines = makeLines(page.headerOcrWords || []);
  const dec = findDeclarationNumber(headerLines.length ? headerLines : lines, page.renderHeight || 1) ||
    findDeclarationNumber(lines, page.renderHeight || 1);
  const dateLines = headerLines.length ? [...headerLines, ...lines] : lines;
  return { sourceFile, pageNumber: page.pageNumber, decNo: dec?.value || "",
    decDate: findDeclarationDate(dec?.line || null, dateLines, page.renderHeight || 1),
    description: findDescription(lines), value: findValue(lines), ocrConfidence: page.ocrConfidence || 0 };
}

function findDeclarationNumber(lines, height) {
  const topLimit = height * 0.45, candidates = [];
  lines.forEach((line, i) => {
    if (line.top > topLimit || isInvoiceLine(line.text) || nearbyInvoiceLabel(lines, i)) return;
    for (const raw of normalizeDigits(line.text).match(DEC_RE) || []) {
      const value = cleanDecNo(raw); let score = line.top;
      if (hasDecLabel(line.text)) score -= 1200;
      if (/^[A-Za-z\u0600-\u06ff]+\//.test(value)) score -= 500;
      if (hasCustomsLabel(line.text)) score -= 250;
      for (let d = 1; d <= 2; d++) if (lines[i-d] && hasDecLabel(lines[i-d].text)) score -= 500 / d;
      candidates.push({ value, line, score });
    }
  });
  return candidates.sort((a,b) => a.score - b.score)[0] || null;
}

function findDeclarationDate(decLine, lines, height) {
  const candidates = [];
  lines.forEach((line, i) => {
    if (line.top > height * 0.48 || isInvoiceLine(line.text) || nearbyInvoiceLabel(lines, i)) return;
    for (const raw of normalizeDigits(line.text).match(DATE_RE) || []) {
      let score = decLine ? lineDistance(decLine, line) : line.top;
      if (hasDateLabel(line.text)) score -= 900;
      if (lines[i-1] && hasDateLabel(lines[i-1].text)) score -= 500;
      candidates.push({ date: cleanDate(raw), score });
    }
  });
  return candidates.sort((a,b) => a.score - b.score)[0]?.date || "";
}

function findValue(lines) {
  for (const line of lines.filter(l => hasValueLabel(l.text))) {
    const labelWord = line.words.find(w => /\bvalue\b/i.test(w.text) || /القيمه|القيمة/.test(arabicClean(w.text)));
    const minX = labelWord ? labelWord.left + labelWord.width * 0.7 : line.left;
    const sameLine = line.words.filter(w => w.left >= minX).sort((a,b) => a.left-b.left).map(w => w.text).join(" ");
    const direct = pickBestMoney(sameLine.replace(/\bvalue\b/i, "")); if (direct) return direct;
    const cy = (line.top + line.bottom) / 2, tolerance = Math.max(30, line.height * 1.7);
    const words = lines.filter(x => Math.abs((x.top+x.bottom)/2-cy) <= tolerance).flatMap(x => x.words);
    const nearby = words.filter(w => w.left >= minX).sort((a,b) => a.left-b.left).map(w => w.text).join(" ");
    const amount = pickBestMoney(nearby.replace(/\bvalue\b/i, "")); if (amount) return amount;
  }
  return "";
}

function findDescription(lines) {
  const goodsIndex = lines.findIndex(l => hasGoodsLabel(l.text)); if (goodsIndex < 0) return "";
  const valueLine = lines.slice(goodsIndex + 1).find(l => hasValueLabel(l.text));
  const stopY = valueLine?.top ?? Number.POSITIVE_INFINITY, out = [];
  for (const line of lines.slice(goodsIndex + 1)) {
    if (line.top >= stopY) break; const raw = normalizeText(line.text).trim(); if (!raw) continue;
    const before = textBeforeDetails(raw);
    if (before !== raw) { const text = cleanDescription(before); if (text) out.push(text); break; }
    if (isDescriptionStop(raw)) break; const text = cleanDescription(raw); if (text) out.push(text);
  }
  return cleanDescription(out.join(" "));
}

function pickBestMoney(text) {
  const normalized = normalizeDigits(text).replace(/(\d)[.,]\s+(\d{2,3})\b/g, "$1.$2");
  const values = (normalized.match(MONEY_RE) || []).map(raw => ({ value:raw.replace(/,/g,""),
    decimal:/[.,]\d{2,3}$/.test(raw), digits:(raw.match(/\d/g)||[]).length })).filter(x => x.digits >= 2);
  values.sort((a,b) => Number(b.decimal)-Number(a.decimal) || b.digits-a.digits);
  return values[0]?.value?.replace(/,(?=\d{2,3}$)/, ".") || "";
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
function nearbyInvoiceLabel(lines,i) { return [i-1,i,i+1].some(n => n>=0 && n<lines.length && isInvoiceLine(lines[n].text)); }
function verticalDistance(a,b) { return Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2); }
function lineDistance(a,b) { return verticalDistance(a,b)+Math.abs((a.left+a.right)/2-(b.left+b.right)/2)*0.12; }
