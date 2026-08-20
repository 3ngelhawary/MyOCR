let worker = null;

export async function createOcrWorker(onProgress) {
  if (!globalThis.Tesseract) throw new Error("Tesseract.js failed to load.");
  const langPath = new URL("../tessdata", import.meta.url).href.replace(/\/$/, "");
  worker = await Tesseract.createWorker(["ara", "eng"], 1, {
    langPath,
    gzip: true,
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.1.2",
    logger: (m) => onProgress?.(m)
  });
  await worker.setParameters({
    preserve_interword_spaces: "1"
  });
  return worker;
}

export async function recognizePage(canvas, dpi) {
  if (!worker) throw new Error("OCR worker is not initialized.");
  await worker.setParameters({ user_defined_dpi: String(dpi) });
  const result = await worker.recognize(
    canvas,
    { rotateAuto: true },
    { text: true, tsv: true }
  );
  const words = parseTsv(result.data.tsv || "");
  const confidence = average(words.map((x) => x.confidence).filter((x) => x >= 0));
  return {
    text: (result.data.text || "").trim(),
    words,
    lines: buildLines(words),
    confidence
  };
}

export async function terminateOcrWorker() {
  if (worker) await worker.terminate().catch(() => {});
  worker = null;
}

function parseTsv(tsv) {
  const lines = tsv.split(/\r?\n/).slice(1);
  const words = [];
  for (const row of lines) {
    if (!row.trim()) continue;
    const c = row.split("\t");
    if (Number(c[0]) !== 5 || !c[11]?.trim()) continue;
    words.push({
      block: Number(c[2]), paragraph: Number(c[3]), line: Number(c[4]), word: Number(c[5]),
      left: Number(c[6]), top: Number(c[7]), width: Number(c[8]), height: Number(c[9]),
      confidence: Number(c[10]), text: c.slice(11).join("\t")
    });
  }
  return words;
}

function buildLines(words) {
  const groups = new Map();
  for (const w of words) {
    const key = `${w.block}:${w.paragraph}:${w.line}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  }
  return [...groups.entries()].map(([key, items]) => ({
    key,
    text: items.map((x) => x.text).join(" "),
    wordCount: items.length,
    confidence: average(items.map((x) => x.confidence).filter((x) => x >= 0))
  }));
}

function average(values) {
  if (!values.length) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
