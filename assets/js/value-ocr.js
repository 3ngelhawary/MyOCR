import { recognizeRegionEnhanced } from "./ocr-service.js?v=1.0.8";

const PASSES = [
  { pageSegMode: "7", scale: 3.0, threshold: null, contrast: 1.8, whitelist: "0123456789.,$ " },
  { pageSegMode: "13", scale: 4.0, threshold: "auto", contrast: 2.0, whitelist: "0123456789.," },
  { pageSegMode: "7", scale: 4.5, threshold: 210, contrast: 2.2, whitelist: "0123456789.," },
  { pageSegMode: "6", scale: 3.5, threshold: 185, contrast: 2.0, whitelist: "0123456789.,$ " }
];

export async function recognizeValueDecimalLayers(canvas, dpi, region) {
  const results = [];
  for (const options of PASSES) {
    const result = await recognizeRegionEnhanced(canvas, dpi, region, options);
    if (result.text?.trim()) results.push(result.text.trim());
    if (hasTwoDecimalValue(result.text)) break;
  }
  return results;
}

export function hasTwoDecimalValue(text) {
  return /\d[\d,]*[.,]\s*\d{2}\b/.test(String(text || ""));
}
