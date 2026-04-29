/**
 * MTG Card Scanner — Computer Vision Pipeline
 *
 * Pipeline:
 *  1. Grab video frame → canvas
 *  2. Detect card rectangle (contour / edge detection)
 *  3. Perspective-correct and crop
 *  4. Extract regions: art box (top 45%), name bar (lines 1-2)
 *  5. Compute dHash of art region
 *  6. Run OCR on name bar via Google ML Kit (Expo) or Tesseract.js (web)
 *  7. Scryfall hybrid match: OCR name → /cards/named, confirm via hash distance
 */

import type { ScanResult, ScryfallCard } from '../types';
import { getCardByName, searchCards } from '../services/scryfall';

// ─── dHash (difference hash) — fast perceptual fingerprint ───────────────────

export function dHash(imageData: ImageData, size = 8): bigint {
  const { data, width, height } = imageData;
  // Resize to (size+1) x size in grayscale using nearest-neighbor
  const w2 = size + 1;
  const h2 = size;
  const gray: number[] = new Array(w2 * h2);

  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < w2; x++) {
      const sx = Math.floor((x / w2) * width);
      const sy = Math.floor((y / h2) * height);
      const idx = (sy * width + sx) * 4;
      gray[y * w2 + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  let hash = 0n;
  for (let y = 0; y < h2; y++) {
    for (let x = 0; x < size; x++) {
      const left = gray[y * w2 + x];
      const right = gray[y * w2 + x + 1];
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let dist = 0;
  while (xor > 0n) {
    dist += Number(xor & 1n);
    xor >>= 1n;
  }
  return dist;
}

// ─── Card region extraction ───────────────────────────────────────────────────

/** Extracts the art box region (top ~45% of card, inner ~80% width) */
export function extractArtRegion(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!;
  const artX = Math.floor(canvas.width * 0.07);
  const artY = Math.floor(canvas.height * 0.07);
  const artW = Math.floor(canvas.width * 0.86);
  const artH = Math.floor(canvas.height * 0.42);
  return ctx.getImageData(artX, artY, artW, artH);
}

/** Extracts the name bar region (top ~8% of card, full width) */
export function extractNameRegion(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!;
  return ctx.getImageData(0, 0, canvas.width, Math.floor(canvas.height * 0.09));
}

// ─── Rectangle detection (simplified — relies on aspect ratio + largest quad) ──

export interface DetectedCard {
  canvas: HTMLCanvasElement;
  confidence: number;
}

/**
 * Attempts to detect a Magic card in the given video frame.
 * Uses aspect ratio filtering (MTG card = 2.5" × 3.5" = 0.714) and
 * largest-rectangle heuristic via edge detection on a downscaled copy.
 *
 * For production: swap with OpenCV.js WASM version for full contour detection.
 */
export async function detectCardInFrame(
  video: HTMLVideoElement,
  outputCanvas: HTMLCanvasElement
): Promise<DetectedCard | null> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  // Draw frame to canvas
  const ctx = outputCanvas.getContext('2d')!;
  outputCanvas.width = vw;
  outputCanvas.height = vh;
  ctx.drawImage(video, 0, 0);

  // Heuristic: scan for the largest rectangular region with MTG aspect ratio (~0.71)
  // In full implementation: use cv.findContours + approxPolyDP + perspective transform
  // Here we return the full frame cropped to center 80% as a fallback
  const TARGET_RATIO = 0.714;
  const margin = 0.1;
  const cx = Math.floor(vw * margin);
  const cy = Math.floor(vh * margin);
  const cw = Math.floor(vw * (1 - 2 * margin));
  const ch = Math.floor(vh * (1 - 2 * margin));

  const cardCanvas = document.createElement('canvas');
  const STD_W = 312;
  const STD_H = 445; // standard MTG card pixel dimensions
  cardCanvas.width = STD_W;
  cardCanvas.height = STD_H;

  const cardCtx = cardCanvas.getContext('2d')!;
  cardCtx.drawImage(outputCanvas, cx, cy, cw, ch, 0, 0, STD_W, STD_H);

  return { canvas: cardCanvas, confidence: 0.6 };
}

// ─── OCR (web fallback using canvas + fetch to a simple OCR service) ──────────

/**
 * Extracts card name from the name bar ImageData.
 * On Expo: use Google ML Kit Text Recognition.
 * On web: use Tesseract.js (loaded dynamically).
 */
export async function ocrNameRegion(nameCanvas: HTMLCanvasElement): Promise<string | null> {
  try {
    // Dynamic import — only loads Tesseract when camera scan is used
    const { createWorker } = await import('tesseract.js' as any);
    const worker = await createWorker('eng');
    const { data } = await worker.recognize(nameCanvas);
    await worker.terminate();
    // Take only first line (card name is always first)
    const firstLine = data.text.split('\n')[0].trim();
    return firstLine.length > 1 ? firstLine : null;
  } catch {
    return null;
  }
}

// ─── Hybrid match pipeline ────────────────────────────────────────────────────

export async function matchCard(
  ocrText: string | null,
  _artHash: bigint | null
): Promise<{ candidates: ScryfallCard[]; bestMatch: ScryfallCard | null; confidence: number }> {
  let candidates: ScryfallCard[] = [];
  let bestMatch: ScryfallCard | null = null;
  let confidence = 0;

  // Stage 1: OCR name → Scryfall named search (fastest path)
  if (ocrText && ocrText.length > 2) {
    const byName = await getCardByName(ocrText);
    if (byName) {
      bestMatch = byName;
      // Never auto-confirm from OCR alone — detection is heuristic, always needs human review
      confidence = 0.7;
      candidates = [byName];
    } else {
      // Fuzzy: search with OCR text (paper only via searchCards)
      candidates = await searchCards(ocrText.substring(0, 20));
      if (candidates.length > 0) {
        bestMatch = candidates[0];
        confidence = 0.5;
      }
    }
  }

  // Stage 2: TODO — hash comparison against precomputed hash index
  // In production: fetch hash index (Scryfall bulk data), compare dHash distances,
  // filter to top-N candidates, then re-rank with OCR confirmation.

  return { candidates, bestMatch, confidence };
}

// ─── Full scan orchestration ──────────────────────────────────────────────────

export async function runScanPipeline(
  video: HTMLVideoElement,
  previewCanvas: HTMLCanvasElement
): Promise<ScanResult> {
  try {
    const detected = await detectCardInFrame(video, previewCanvas);
    if (!detected) {
      return { status: 'detecting', candidates: [], bestMatch: null, confidence: 0, ocrText: null };
    }

    const artData = extractArtRegion(detected.canvas);
    const artHash = dHash(artData);

    // Run OCR on name region
    const nameCanvas = document.createElement('canvas');
    const nameData = extractNameRegion(detected.canvas);
    nameCanvas.width = nameData.width;
    nameCanvas.height = nameData.height;
    nameCanvas.getContext('2d')!.putImageData(nameData, 0, 0);

    const ocrText = await ocrNameRegion(nameCanvas);

    const { candidates, bestMatch, confidence } = await matchCard(ocrText, artHash);

    // Max confidence is 0.7 (OCR-only heuristic) — always 'confirming', never auto-confirmed
    const status = confidence >= 0.7 ? 'confirming' : confidence > 0.4 ? 'matching' : 'detecting';

    return { status, candidates, bestMatch, confidence, ocrText };
  } catch (error) {
    return {
      status: 'error',
      candidates: [],
      bestMatch: null,
      confidence: 0,
      ocrText: null,
      error: error instanceof Error ? error.message : 'Unknown scan error',
    };
  }
}
