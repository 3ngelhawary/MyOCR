let worker = null;

const OCR_RUNTIMES = [
  { name: "unpkg", workerPath: "https://unpkg.com/tesseract.js@7.0.0/dist/worker.min.js",
    corePath: "https://unpkg.com/tesseract.js-core@7.0.0/tesseract-core-lstm.wasm.js" },
  { name: "jsDelivr", workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/tesseract-core-lstm.wasm.js" }
];

export async function createOcrWorker(onProgress) {
  if (!globalThis.Tesseract) throw new Error("Tesseract.js failed to load.");
  const langPath = new URL("../tessdata", import.meta.url).href.replace(/\/$/, ""), errors = [];
  for (const runtime of OCR_RUNTIMES) {
    try {
      onProgress?.({ status: `loading OCR runtime from ${runtime.name}`, progress: 0 });
      worker = await Tesseract.createWorker(["ara", "eng"], 1, { langPath, gzip: true,
        workerPath: runtime.workerPath, corePath: runtime.corePath, workerBlobURL: true, logger: m => onProgress?.(m) });
      await worker.setParameters({ preserve_interword_spaces: "1" }); return worker;
    } catch (error) {
      errors.push(`${runtime.name}: ${error?.message || error}`);
      if (worker) await worker.terminate().catch(() => {}); worker = null;
    }
  }
  throw new Error(`OCR runtime failed to load. ${errors.join(" | ")}`);
}

export async function recognizePage(canvas, dpi) {
  if (!worker) throw new Error("OCR worker is not initialized.");
  await worker.setParameters({ user_defined_dpi: String(dpi) });
  const result = await worker.recognize(canvas, { rotateAuto: true }, { text: true, tsv: true });
  return makeResult(result);
}

export async function recognizeRegion(canvas, dpi, region, pageSegMode = "11") {
  const crop = createCrop(canvas, region, false);
  return recognizeCrop(crop.canvas, dpi, pageSegMode, "", crop.offsetX, crop.offsetY, crop.scale);
}

export async function recognizeRegionEnhanced(canvas, dpi, region, options = {}) {
  const crop = createCrop(canvas, region, true, options.scale || 1.6, options.threshold ?? null, options.contrast || 1.35);
  return recognizeCrop(crop.canvas, Math.round(dpi * crop.scale), options.pageSegMode || "6",
    options.whitelist || "", crop.offsetX, crop.offsetY, crop.scale);
}

export async function terminateOcrWorker() {
  if (worker) await worker.terminate().catch(() => {}); worker = null;
}

async function recognizeCrop(canvas, dpi, pageSegMode, whitelist, offsetX, offsetY, scale) {
  if (!worker) throw new Error("OCR worker is not initialized.");
  const parameters = { user_defined_dpi: String(dpi), tessedit_pageseg_mode: String(pageSegMode) };
  if (whitelist) parameters.tessedit_char_whitelist = whitelist;
  await worker.setParameters(parameters);
  try {
    const result = await worker.recognize(canvas, { rotateAuto: false }, { text: true, tsv: true });
    const parsed = makeResult(result);
    parsed.words = parsed.words.map(w => ({ ...w, left: w.left / scale + offsetX, top: w.top / scale + offsetY,
      width: w.width / scale, height: w.height / scale }));
    return parsed;
  } finally {
    canvas.width = 1; canvas.height = 1;
    await worker.setParameters({ tessedit_pageseg_mode: "3", tessedit_char_whitelist: "" }).catch(() => {});
  }
}

function createCrop(source, region, enhance, scale = 1, threshold = null, contrast = 1.35) {
  const left = Math.max(0, Math.floor(region.left || 0)), top = Math.max(0, Math.floor(region.top || 0));
  const width = Math.max(1, Math.min(source.width - left, Math.floor(region.width || source.width)));
  const height = Math.max(1, Math.min(source.height - top, Math.floor(region.height || source.height)));
  const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(source, left, top, width, height, 0, 0, canvas.width, canvas.height);
  if (enhance) preprocess(ctx, canvas.width, canvas.height, threshold, contrast);
  return { canvas, offsetX: left, offsetY: top, scale };
}

function preprocess(ctx, width, height, threshold, contrast) {
  const image = ctx.getImageData(0, 0, width, height), data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    let v = threshold == null ? 128 + (gray - 128) * contrast : (gray < threshold ? 0 : 255);
    v = Math.max(0, Math.min(255, Math.round(v))); data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function makeResult(result) {
  const words = parseTsv(result.data.tsv || "");
  return { text: (result.data.text || "").trim(), words, lines: buildLines(words),
    confidence: average(words.map(x => x.confidence).filter(x => x >= 0)) };
}

function parseTsv(tsv) {
  const words = [];
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    if (!row.trim()) continue; const c = row.split("\t");
    if (Number(c[0]) !== 5 || !c[11]?.trim()) continue;
    words.push({ block:Number(c[2]), paragraph:Number(c[3]), line:Number(c[4]), word:Number(c[5]),
      left:Number(c[6]), top:Number(c[7]), width:Number(c[8]), height:Number(c[9]), confidence:Number(c[10]),
      text:c.slice(11).join("\t") });
  }
  return words;
}

function buildLines(words) {
  const groups = new Map();
  for (const w of words) { const key=`${w.block}:${w.paragraph}:${w.line}`; if (!groups.has(key)) groups.set(key,[]); groups.get(key).push(w); }
  return [...groups.entries()].map(([key,items]) => ({ key, text:items.map(x=>x.text).join(" "), wordCount:items.length,
    confidence:average(items.map(x=>x.confidence).filter(x=>x>=0)) }));
}

function average(values) { return values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10 : 0; }
