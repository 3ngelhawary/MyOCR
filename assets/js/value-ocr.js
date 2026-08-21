import { recognizeRegionEnhanced } from "./ocr-service.js?v=1.0.6";

export async function recognizeValueDecimalLayers(canvas, dpi, region) {
  const results = [];
  const passes = [
    { pageSegMode:"7", scale:3.0, threshold:null, contrast:1.8, whitelist:"0123456789.,$ " },
    { pageSegMode:"13", scale:4.0, threshold:185, contrast:2.0, whitelist:"0123456789.," },
    { pageSegMode:"7", scale:4.5, threshold:210, contrast:2.2, whitelist:"0123456789.," }
  ];
  for (const options of passes) {
    const result = await recognizeRegionEnhanced(canvas, dpi, region, options);
    if (result.text?.trim()) results.push(result.text.trim());
    if (hasTwoDecimalValue(result.text)) break;
  }
  return results;
}

export function hasTwoDecimalValue(text) {
  return /\d[\d,]*[.,]\s*\d{2}\b/.test(String(text || ""));
}
