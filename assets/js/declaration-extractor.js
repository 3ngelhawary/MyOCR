const DEC_RE = /(?:[\p{L}\p{N}_-]{1,20}\.\s*\/\s*)?\d{3,5}\s*\/\s*(?:19|20)\d{2}/gu;
const DATE_RE = /\b(?:0?[1-9]|[12]\d|3[01])\s*[\/.\-]\s*(?:0?[1-9]|1[0-2])\s*[\/.\-]\s*(?:19|20)\d{2}\b/g;
const MONEY_RE = /(?:[$€£]\s*)?\d[\d,]*(?:\.\d{1,3})?/g;

export function extractDeclarations(page, sourceFile) {
  const words = page.ocrWords || [];
  const lines = makeLines(words);
  const text = normalizeDigits(page.ocrText || page.nativeText || "");
  const declarations = findUnique(text.match(DEC_RE) || []).map(cleanDecNo);
  if (!declarations.length) return [];
  const description = findDescription(words, lines, page);
  const value = findValue(words, lines, page);
  return declarations.map((decNo) => ({
    sourceFile,
    pageNumber: page.pageNumber,
    decNo,
    decDate: findDeclarationDate(decNo, lines, text),
    description,
    value,
    ocrConfidence: page.ocrConfidence || 0
  }));
}

export function normalizeDigits(value) {
  const ar = "٠١٢٣٤٥٦٧٨٩", fa = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "").replace(/[٠-٩]/g, c => ar.indexOf(c)).replace(/[۰-۹]/g, c => fa.indexOf(c));
}

function findDeclarationDate(decNo, lines, text) {
  const decLine = lines.find(l => compact(l.text).includes(compact(decNo)));
  const candidates = [];
  for (const line of lines) {
    const matches = normalizeDigits(line.text).match(DATE_RE) || [];
    for (const date of matches) candidates.push({ date: cleanDate(date), line });
  }
  if (!candidates.length) return cleanDate((text.match(DATE_RE) || [""])[0]);
  if (!decLine) return candidates[0].date;
  candidates.sort((a, b) => lineDistance(decLine, a.line) - lineDistance(decLine, b.line));
  return candidates[0].date;
}

function findValue(words, lines, page) {
  const label = words.find(w => /^value$/i.test(cleanToken(w.text)));
  if (label) {
    const cx = label.left + label.width / 2;
    const maxY = Math.max(120, (page.renderHeight || 0) * 0.28);
    const maxX = Math.max(100, (page.renderWidth || 0) * 0.12);
    const candidates = words.filter(w => w.top >= label.top + label.height * 0.4)
      .map(w => ({ w, raw: moneyToken(w.text) })).filter(x => x.raw)
      .filter(x => Math.abs((x.w.left + x.w.width / 2) - cx) <= maxX && x.w.top - label.top <= maxY)
      .map(x => ({ ...x, score: (x.w.top - label.top) + Math.abs((x.w.left + x.w.width / 2) - cx) * 0.35 }));
    candidates.sort((a, b) => a.score - b.score);
    if (candidates.length) return candidates[0].raw;
  }
  const valueLine = lines.find(l => /\bvalue\b/i.test(l.text));
  if (valueLine) {
    const same = moneyMatches(valueLine.text.replace(/\bvalue\b/ig, ""));
    if (same.length) return same[0];
    const below = lines.filter(l => l.top > valueLine.bottom).sort((a,b) => a.top - b.top).slice(0, 3);
    for (const line of below) { const values = moneyMatches(line.text); if (values.length) return values[0]; }
  }
  return "";
}

function findDescription(words, lines, page) {
  const label = words.find(w => isGoodsLabel(w.text));
  if (label) {
    const cx = label.left + label.width / 2;
    const halfWidth = Math.max(140, (page.renderWidth || 0) * 0.18);
    const maxY = Math.max(180, (page.renderHeight || 0) * 0.25);
    const candidateLines = lines.filter(l => l.top >= label.top + label.height * 0.5 && l.top - label.top <= maxY)
      .map(l => ({ line: l, words: l.words.filter(w => Math.abs((w.left + w.width / 2) - cx) <= halfWidth) }))
      .filter(x => x.words.length && !x.words.some(w => isGoodsLabel(w.text)))
      .sort((a,b) => a.line.top - b.line.top);
    if (candidateLines.length) {
      const first = candidateLines[0];
      const selected = [first];
      for (const next of candidateLines.slice(1, 3)) {
        if (next.line.top - selected.at(-1).line.bottom > Math.max(45, first.line.height * 2.2)) break;
        selected.push(next);
      }
      const text = selected.map(x => joinReadingOrder(x.words)).join(" ").trim();
      if (text) return text;
    }
  }
  const index = lines.findIndex(l => hasGoodsLabel(l.text));
  if (index >= 0) {
    for (const line of lines.slice(index + 1, index + 5)) {
      const text = line.text.trim();
      if (text && !isKnownLabelLine(text)) return text;
    }
  }
  return "";
}

function makeLines(words) {
  const map = new Map();
  for (const w of words) {
    const key = `${w.block}:${w.paragraph}:${w.line}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(w);
  }
  return [...map.values()].map(items => {
    const left = Math.min(...items.map(w => w.left)), top = Math.min(...items.map(w => w.top));
    const right = Math.max(...items.map(w => w.left + w.width)), bottom = Math.max(...items.map(w => w.top + w.height));
    return { words: items, text: joinReadingOrder(items), left, top, right, bottom, height: bottom - top };
  }).sort((a,b) => a.top - b.top || a.left - b.left);
}

function joinReadingOrder(words) {
  const arabic = words.reduce((n,w) => n + ((w.text.match(/[\u0600-\u06ff]/g) || []).length), 0);
  const latin = words.reduce((n,w) => n + ((w.text.match(/[A-Za-z]/g) || []).length), 0);
  return [...words].sort((a,b) => arabic > latin ? b.left - a.left : a.left - b.left).map(w => w.text).join(" ");
}

function isGoodsLabel(text) { const t = arabicClean(cleanToken(text)); return t === "goods" || t === "good" || t.includes("الطرود") || t === "طرود"; }
function hasGoodsLabel(text) { return String(text).split(/\s+/).some(isGoodsLabel); }
function isKnownLabelLine(text) { return /\b(value|date|declaration|dec\.?|no\.?|weight|invoice)\b/i.test(text) || hasGoodsLabel(text); }
function moneyMatches(text) { return (normalizeDigits(text).match(MONEY_RE) || []).map(moneyToken).filter(Boolean); }
function moneyToken(text) {
  const normalized = normalizeDigits(text).replace(/\s/g, "");
  const match = normalized.match(/(?:[$€£])?(\d[\d,]*(?:\.\d{1,3})?)/);
  if (!match) return "";
  const value = match[1].replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,3})?$/.test(value)) return "";
  return value;
}
function cleanToken(text) { return normalizeDigits(text).toLowerCase().replace(/[\u200e\u200f\u202a-\u202e]/g, "").replace(/[\s:;,$€£()[\]{}]/g, "").replace(/[ـ]/g, ""); }
function arabicClean(text) { return text.replace(/[إأآ]/g, "ا").replace(/[ًٌٍَُِّْ]/g, ""); }
function cleanDecNo(text) { return normalizeDigits(text).replace(/\s+/g, "").replace(/\/{2,}/g, "/"); }
function cleanDate(text) { return normalizeDigits(text).replace(/\s+/g, "").replace(/[.\-]/g, "/"); }
function compact(text) { return normalizeDigits(text).replace(/\s+/g, "").toLowerCase(); }
function findUnique(values) { return [...new Set(values.map(cleanDecNo))]; }
function lineDistance(a, b) { return Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) + Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2) * 0.12; }
