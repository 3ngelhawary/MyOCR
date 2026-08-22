const LETTERS = /[A-Za-z\u0600-\u06ff]/g;

export function buildNativeWords(items, heightPt) {
  const boxes = [];
  for (const item of items || []) {
    const text = String(item.text || "").trim();
    if (!text) continue;
    const height = item.height > 0 ? item.height : 10;
    boxes.push({ left: item.x, top: heightPt - item.y - height, width: item.width > 0 ? item.width : text.length * height * 0.5, height, text });
  }
  boxes.sort((a, b) => a.top - b.top || a.left - b.left);
  const lines = [];
  for (const box of boxes) {
    const line = lines.find(l => Math.abs(l.top - box.top) <= Math.max(2, box.height * 0.6));
    if (line) { line.items.push(box); line.top = Math.min(line.top, box.top); }
    else lines.push({ top: box.top, items: [box] });
  }
  const words = [];
  lines.sort((a, b) => a.top - b.top).forEach((line, lineIndex) => {
    line.items.sort((a, b) => a.left - b.left).forEach(item => {
      for (const part of splitItem(item)) {
        words.push({ block: 0, paragraph: 0, line: lineIndex, word: words.length, confidence: 100, ...part });
      }
    });
  });
  return words;
}

export function nativeTextQuality(words) {
  if (!words.length) return 0;
  const letters = words.reduce((n, w) => n + (w.text.match(LETTERS) || []).length, 0);
  const digits = words.reduce((n, w) => n + (w.text.match(/\d/g) || []).length, 0);
  const positioned = words.filter(w => w.width > 0 && w.height > 0).length / words.length;
  if (words.length < 12 || letters + digits < 60) return 0;
  return Math.round(Math.min(100, (letters + digits) / 4) * positioned);
}

function splitItem(item) {
  const parts = String(item.text).split(/\s+/).filter(Boolean);
  const chars = parts.reduce((n, p) => n + p.length, 0) || 1;
  const gap = parts.length > 1 ? item.width * 0.02 : 0;
  const usable = Math.max(1, item.width - gap * (parts.length - 1));
  const out = [];
  let x = item.left;
  for (const part of parts) {
    const width = usable * (part.length / chars);
    out.push({ left: x, top: item.top, width, height: item.height, text: part });
    x += width + gap;
  }
  return out;
}
