import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs";

export async function loadPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const baseUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/";
  const task = pdfjsLib.getDocument({
    data,
    cMapUrl: baseUrl + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: baseUrl + "standard_fonts/",
    wasmUrl: baseUrl + "wasm/",
    useWasm: true
  });
  task.onPassword = (updatePassword) => {
    const password = window.prompt("This PDF is password protected. Enter the password:") || "";
    updatePassword(password);
  };
  const pdf = await task.promise;
  const meta = await pdf.getMetadata().catch(() => ({}));
  const outline = await pdf.getOutline().catch(() => []);
  const metadata = {
    info: clean(meta.info || {}),
    xmp: clean(meta.metadata?.getAll?.() || {}),
    contentDispositionFilename: meta.contentDispositionFilename || "",
    contentLength: meta.contentLength || 0
  };
  return { pdf, loadingTask: task, metadata, outline: clean(outline) };
}

export async function extractPageData(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const [textContent, annotations, operators] = await Promise.all([
    page.getTextContent().catch(() => ({ items: [] })),
    page.getAnnotations({ intent: "display" }).catch(() => []),
    page.getOperatorList().catch(() => ({ fnArray: [] }))
  ]);
  const nativeItems = (textContent.items || []).map((item) => ({
    text: item.str || "",
    x: round(item.transform?.[4]),
    y: round(item.transform?.[5]),
    width: round(item.width),
    height: round(item.height),
    fontName: item.fontName || "",
    dir: item.dir || ""
  }));
  return {
    page,
    widthPt: round(viewport.width),
    heightPt: round(viewport.height),
    rotation: page.rotate || 0,
    nativeText: nativeItems.map((x) => x.text).join(" ").trim(),
    nativeItems,
    annotations: clean(annotations),
    operationCount: operators.fnArray?.length || 0
  };
}

export async function renderPage(page, requestedDpi, maxPixels = 30000000) {
  const base = page.getViewport({ scale: 1 });
  let scale = requestedDpi / 72;
  const pixels = base.width * base.height * scale * scale;
  if (pixels > maxPixels) scale *= Math.sqrt(maxPixels / pixels);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, effectiveDpi: Math.round(scale * 72) };
}

export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG conversion failed.")), "image/png");
  });
}

function clean(value, depth = 0) {
  if (depth > 5 || value == null) return value;
  if (Array.isArray(value)) return value.map((x) => clean(x, depth + 1));
  if (typeof value !== "object") return typeof value === "function" ? undefined : value;
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (typeof val !== "function") out[key] = clean(val, depth + 1);
  }
  return out;
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
}
