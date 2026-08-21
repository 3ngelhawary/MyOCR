export function normalizeDigits(value) {
  const ar = "٠١٢٣٤٥٦٧٨٩", fa = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "").replace(/[٠-٩]/g, c => ar.indexOf(c)).replace(/[۰-۹]/g, c => fa.indexOf(c));
}

export function normalizeText(t) {
  return normalizeDigits(t).replace(/[\u200e\u200f\u202a-\u202e]/g, " ");
}

export function arabicClean(t) {
  return String(t || "").replace(/[إأآ]/g, "ا").replace(/[ًٌٍَُِّْ]/g, "");
}

export function hasCustomsLabel(t) {
  const x = arabicClean(t);
  return /\bcustoms?\b/i.test(x) || /جمرك/.test(x);
}

export function hasDecLabel(t) {
  return /\b(?:customs?\s+)?dec(?:laration)?\s*\.?\s*(?:no|number)\b/i.test(t) ||
    /رقم\s*(?:البيان|التصريح)/.test(arabicClean(t));
}

export function hasDateLabel(t) {
  return /\bdate\b/i.test(t) || /التاريخ/.test(arabicClean(t));
}

export function isInvoiceLine(t) {
  return /\binvoices?\b|\binv\.?\s*['’]?s?\s*(?:no|number|#)?\b/i.test(t);
}

export function hasGoodsLabel(t) {
  const x = arabicClean(t);
  return /\b(?:description\s+of\s+)?goods?\b/i.test(x) || /الطرود|طرود/.test(x);
}

export function hasValueLabel(t) {
  return /\bvalue\b/i.test(t) || /القيمه|القيمة/.test(arabicClean(t));
}

export function hasFormSignature(t) {
  return /number\s*,?\s*kind\s+of\s+pack/i.test(t) || /gross\s*w(?:t|eight)/i.test(t) ||
    /p\.?\s*order\s*no/i.test(t) || /supplier/i.test(t) || /رقم\s*الفاتور/.test(arabicClean(t));
}

export function textBeforeDetails(t) {
  const x = String(t || "");
  const i = x.search(/d[e3]ta[i1l]l?s?\s+as\s+per|inv(?:oice)?\.?\s*['’]?s?\s*(?:att|attachment)/i);
  return i >= 0 ? x.slice(0, i).trim() : x;
}

export function isDescriptionStop(t) {
  return /\b(weight|invoice|currency|origin|supplier|p\.?\s*order|gross\s*wt)\b/i.test(t) ||
    /الوزن|الفاتوره|الفاتورة|المورد/.test(arabicClean(t));
}

export function cleanDescription(t) {
  let x = normalizeText(t).replace(/\s{2,}/g, " ").trim();
  x = stripQuantityPrefix(x);
  x = x.replace(/\s*,\s*/g, ", ").replace(/\(\s*/g, "( ").replace(/\s*\)/g, " )");
  x = repairClosingParenthesis(x);
  return x.replace(/\s{2,}/g, " ").trim();
}

export function cleanDecNo(t) {
  return normalizeDigits(t).replace(/\s+/g, "").replace(/\/{2,}/g, "/");
}

export function cleanDate(t) {
  return normalizeDigits(t).replace(/\s+/g, "").replace(/[.\-]/g, "/");
}

function stripQuantityPrefix(t) {
  const colon = t.search(/[:：؛]/);
  if (colon < 0 || colon > 32) return t;
  const head = t.slice(0, colon).trim(), tail = t.slice(colon + 1).trim();
  const unit = /(?:EA|EACH|PCS?|NOS?|UNITS?|PKGS?|CTNS?|BOX(?:ES)?|SETS?|LOTS?|KGS?|KG|[\u0600-\u06ff]{1,3})/i;
  const qty = new RegExp(`^(?:\\d+\\s+){0,3}\\d+(?:[.,]\\d+)?\\s*${unit.source}$`, "i");
  return qty.test(normalizeDigits(head)) && /[A-Za-z\u0600-\u06ff]/.test(tail) ? tail : t;
}

function repairClosingParenthesis(t) {
  const opens = (t.match(/\(/g) || []).length, closes = (t.match(/\)/g) || []).length;
  return opens > closes && /\(\s*$/.test(t) ? t.replace(/\(\s*$/, " )") : t;
}
