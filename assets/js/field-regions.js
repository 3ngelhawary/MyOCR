import { arabicClean } from "./declaration-text.js?v=1.0.8";

export function getFieldRegions(page) {
  const words = page.ocrWords || [];
  const width = page.renderWidth || 1, height = page.renderHeight || 1;
  const goods = findWord(words, isGoodsWord);
  const value = findWord(words, isValueWord);
  const dec = findWord(words, isDecWord);
  return {
    description: descriptionRegion(goods, value, width, height),
    value: valueRegion(value, goods, width, height),
    header: headerRegion(dec, width, height)
  };
}

function headerRegion(dec, width, height) {
  if (!dec) return { left: 0, top: 0, width, height: height * 0.34 };
  const top = Math.max(0, dec.top - Math.max(14, dec.height * 1.6));
  return { left: 0, top, width, height: Math.min(height - top, Math.max(height * 0.12, dec.height * 6)) };
}

function descriptionRegion(goods, value, width, height) {
  const defaultTop = height * 0.36, defaultBottom = height * 0.72;
  const top = goods ? goods.top + goods.height + Math.max(8, goods.height * 0.5) : defaultTop;
  let bottom = value ? value.top - Math.max(8, value.height * 0.6) : defaultBottom;
  if (bottom <= top + 30) bottom = Math.min(height * 0.76, top + height * 0.25);
  return { left: width * 0.025, top, width: width * 0.95, height: Math.max(30, bottom - top) };
}

function valueRegion(value, goods, width, height) {
  if (value) {
    const top = Math.max(0, value.top - Math.max(10, value.height * 0.8));
    const left = Math.max(width * 0.42, value.left - width * 0.05);
    return { left, top, width: width - left - width * 0.02, height: Math.max(42, value.height * 2.8) };
  }
  const top = goods ? Math.max(height * 0.48, goods.top + height * 0.12) : height * 0.52;
  return { left: width * 0.38, top, width: width * 0.60, height: Math.min(height * 0.11, height - top) };
}

function findWord(words, predicate) {
  return words.filter(predicate).sort((a, b) => a.top - b.top || a.left - b.left)[0] || null;
}

function isGoodsWord(w) {
  const t = arabicClean(w.text || "");
  return /^goods?$/i.test(t.replace(/[^A-Za-z]/g, "")) || /الطرود|طرود/.test(t);
}

function isValueWord(w) {
  const t = arabicClean(w.text || "");
  return /^value$/i.test(t.replace(/[^A-Za-z]/g, "")) || /القيمه|القيمة/.test(t);
}

function isDecWord(w) {
  const t = arabicClean(w.text || "");
  return /^dec(?:laration)?\.?$/i.test(t.replace(/[^A-Za-z.]/g, "")) || /البيان|التصريح/.test(t);
}
