import { cleanDescription, normalizeDigits, normalizeText, textBeforeDetails } from "./declaration-text.js?v=1.0.4";

const MONEY_RE = /\d[\d,]*(?:[.,]\d{2,3})?/g;

export function validateDescription(primary, secondary) {
  const a = normalizeDescription(primary), b = normalizeDescription(secondary);
  if (!b) return a;
  if (!a) return b;
  return descriptionScore(b) >= descriptionScore(a) ? b : a;
}

export function validateValue(primary, secondary) {
  const a = normalizeMoney(primary), b = normalizeMoney(secondary);
  if (!b) return a;
  if (!a) return b;
  const sa = moneyScore(a), sb = moneyScore(b);
  return sb >= sa ? b : a;
}

export function extractFocusedValue(text) {
  const x = normalizeDigits(text).replace(/(\d)[.,]\s+(\d{2,3})\b/g, "$1.$2");
  const values = (x.match(MONEY_RE) || []).map(normalizeMoney).filter(Boolean);
  values.sort((a, b) => moneyScore(b) - moneyScore(a));
  return values[0] || "";
}

export function extractFocusedDescription(text) {
  let x = normalizeText(text).replace(/\r/g, "\n");
  x = textBeforeDetails(x);
  x = x.replace(/number\s*,?\s*kind\s+of\s+package\s*&?\s*description\s+of\s+goods/ig, " ");
  x = x.replace(/(?:kind\s+of\s+package\s*&?\s*)?description\s+of\s+goods/ig, " ");
  x = x.replace(/\bvalue\b[\s\S]*$/i, " ");
  return cleanDescription(x.replace(/\n+/g, " "));
}

function normalizeDescription(value) {
  return extractFocusedDescription(value || "");
}

function descriptionScore(value) {
  const letters = (value.match(/[A-Za-z\u0600-\u06ff]/g) || []).length;
  const bad = /number\s*,?\s*kind|description\s+of\s+goods|details\s+as\s+per|invoice/i.test(value) ? 100 : 0;
  return letters - bad;
}

function normalizeMoney(value) {
  const x = String(value || "").replace(/,/g, "").trim();
  const m = x.match(/^\d+(?:[.]\d{1,3})?$/);
  if (!m) return "";
  return x;
}

function moneyScore(value) {
  const decimal = /\.\d{2}$/.test(value) ? 120 : /\.\d{1,3}$/.test(value) ? 70 : 0;
  const digits = (value.match(/\d/g) || []).length;
  const n = Number(value);
  return decimal + digits * 4 + (n >= 10 ? 20 : 0) + (n >= 100 ? 20 : 0);
}
