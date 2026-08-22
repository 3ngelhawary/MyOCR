import { cleanDescription, normalizeDigits, normalizeText, textBeforeDetails } from "./declaration-text.js?v=1.0.8";

const MONEY_RE = /\d[\d,]*(?:[.,]\d{2,3})?/g;
const SEPARATOR_EVIDENCE = /\d\s*[.,]\s*\d{2}(?!\d)/;

export function validateDescription(primary, secondary) {
  const a = normalizeDescription(primary), b = normalizeDescription(secondary);
  if (!b) return a;
  if (!a) return b;
  return descriptionScore(b) >= descriptionScore(a) ? b : a;
}

export function validateValue(primary, secondary, decimalEvidence = "", mode = "evidence") {
  const raw = [primary, secondary, decimalEvidence].filter(Boolean).join(" ");
  const candidates = [primary, secondary, ...extractMoneyCandidates(decimalEvidence)]
    .map(normalizeMoney).filter(Boolean);
  if (!candidates.length) return { value: "", flags: ["value-missing"] };
  candidates.sort((a, b) => moneyScore(b) - moneyScore(a));
  const explicit = candidates.find(x => /\.\d{2}$/.test(x));
  if (explicit) return { value: explicit, flags: [] };
  const best = candidates[0];
  if (mode === "never" || !/^\d{4,}$/.test(best)) return { value: best, flags: ["no-decimal-found"] };
  if (mode === "always" || SEPARATOR_EVIDENCE.test(normalizeDigits(raw))) {
    return { value: recoverCurrencyDecimal(best), flags: ["decimal-recovered"] };
  }
  return { value: best, flags: ["no-decimal-found"] };
}

export function extractFocusedValue(text) {
  const values = extractMoneyCandidates(text).map(normalizeMoney).filter(Boolean);
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

function normalizeDescription(value) { return extractFocusedDescription(value || ""); }

function descriptionScore(value) {
  const letters = (value.match(/[A-Za-z\u0600-\u06ff]/g) || []).length;
  const bad = /number\s*,?\s*kind|description\s+of\s+goods|details\s+as\s+per|invoice/i.test(value) ? 100 : 0;
  return letters - bad;
}

function normalizeMoney(value) {
  const x = String(value || "").replace(/,/g, "").trim();
  return /^\d+(?:[.]\d{1,3})?$/.test(x) ? x : "";
}

function moneyScore(value) {
  const decimal = /\.\d{2}$/.test(value) ? 120 : /\.\d{1,3}$/.test(value) ? 70 : 0;
  const digits = (value.match(/\d/g) || []).length;
  const n = Number(value);
  return decimal + digits * 4 + (n >= 10 ? 20 : 0) + (n >= 100 ? 20 : 0);
}

function extractMoneyCandidates(text) {
  const x = normalizeDigits(text).replace(/(\d)[.,]\s+(\d{2,3})\b/g, "$1.$2").replace(/(\d)\s+[.,]\s*(\d{2})(?!\d)/g, "$1.$2");
  return x.match(MONEY_RE) || [];
}

function recoverCurrencyDecimal(value) {
  if (/\./.test(value)) return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return value;
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}
