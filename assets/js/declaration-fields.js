import { normalizeDigits, arabicClean, isInvoiceLine } from "./declaration-text.js?v=1.0.8";

const NUMBER_RE = /\b[A-Za-z]{0,4}[-/]?\d{3,}(?:[-/]\d{1,6})*\b/g;
const DATE_RE = /\b(?:0?[1-9]|[12]\d|3[01])\s*[\/.\-]\s*(?:0?[1-9]|1[0-2])\s*[\/.\-]\s*(?:19|20)\d{2}\b/;
const PACKAGE_RE = /\b(\d{1,6})\s*(CTNS?|CARTONS?|PKGS?|PACKAGES?|PCS?|PIECES?|BOX(?:ES)?|BAGS?|PLTS?|PALLETS?|DRUMS?|ROLLS?|SETS?|EA)\b/i;
const WEIGHT_RE = /(?:gross\s*w(?:t|eight)|net\s*w(?:t|eight)|الوزن)[^0-9]{0,14}(\d[\d,]*(?:\.\d{1,3})?)\s*(kgs?|kg|tons?|lbs?)?/i;
const CURRENCY_RE = /\b(USD|EUR|EGP|GBP|AED|SAR|KWD|JPY|CNY|CHF)\b/i;

export function extractExtraFields(lines) {
  const all = lines.map(l => l.text).join("\n");
  return {
    shahadaNo: labelledNumber(lines, /shahada|shahadah|شهاده|شهادة/i),
    kasimaNo: labelledNumber(lines, /kasima|qasima|قسيمه|قسيمة/i),
    kasimaDate: labelledDate(lines, /kasima|qasima|قسيمه|قسيمة/i),
    invoiceNo: invoiceNumber(lines),
    packages: firstMatch(all, PACKAGE_RE, m => `${normalizeDigits(m[1])} ${m[2].toUpperCase()}`),
    grossWeight: firstMatch(all, WEIGHT_RE, m => `${normalizeDigits(m[1])}${m[2] ? " " + m[2].toUpperCase() : ""}`),
    currency: firstMatch(all, CURRENCY_RE, m => m[1].toUpperCase()) || (/\$/.test(all) ? "USD" : "")
  };
}

function firstMatch(text, regex, format) {
  const m = normalizeDigits(text).match(regex);
  return m ? format(m).trim() : "";
}

function labelledNumber(lines, label) {
  for (const scope of labelScopes(lines, label)) {
    const numbers = normalizeDigits(scope).match(NUMBER_RE) || [];
    const pick = numbers.find(n => (n.match(/\d/g) || []).length >= 3 && !DATE_RE.test(n));
    if (pick) return pick.replace(/\s+/g, "");
  }
  return "";
}

function labelledDate(lines, label) {
  for (const scope of labelScopes(lines, label)) {
    const m = normalizeDigits(scope).match(DATE_RE);
    if (m) return m[0].replace(/\s+/g, "").replace(/[.\-]/g, "/");
  }
  return "";
}

function invoiceNumber(lines) {
  for (const line of lines) {
    if (!isInvoiceLine(line.text)) continue;
    const tokens = normalizeDigits(line.text).match(/\b[A-Za-z0-9][A-Za-z0-9/\-]{2,}\b/g) || [];
    const pick = tokens.find(t => /\d/.test(t) && !/^(?:invoice|inv|no|number)$/i.test(t) && !DATE_RE.test(t));
    if (pick) return pick;
  }
  return "";
}

function labelScopes(lines, label) {
  const scopes = [];
  lines.forEach((line, index) => {
    const text = arabicClean(line.text);
    const hit = text.match(label);
    if (!hit) return;
    const after = line.text.slice(hit.index + hit[0].length);
    scopes.push([after, lines[index + 1]?.text || ""].join(" "));
  });
  return scopes;
}
