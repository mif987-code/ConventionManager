/**
 * MTG Card Scanner — Computer Vision Pipeline
 *
 * Pipeline:
 *  1. Grab video frame → canvas
 *  2. Detect card rectangle (crop center 80% as heuristic)
 *  3. Extract regions: name bar (top 9%), bottom strip (bottom 8%), art box
 *  4. PRIMARY: OCR bottom strip → parse set code + collector number → /cards/{set}/{num}
 *  5. FALLBACK: OCR name bar → fuzzy Scryfall search
 *  6. All results marked needsConfirmation — user always verifies
 */

import type { ScanResult, ScryfallCard } from '../types';
import { getCardByName, getCardBySetNumber, searchCards } from '../services/scryfall';

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

/** Extracts the name bar region (top ~9% of card, full width) */
export function extractNameRegion(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!;
  return ctx.getImageData(0, 0, canvas.width, Math.floor(canvas.height * 0.09));
}

/**
 * Extracts the bottom info strip (~8% height, full width).
 * MTG bottom line contains: collector number, set code, language, artist.
 * e.g. "123/456 · IKO · EN  John Doe"
 */
export function extractBottomRegion(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!;
  const stripH = Math.floor(canvas.height * 0.08);
  const stripY = canvas.height - stripH;
  const imageData = ctx.getImageData(0, stripY, canvas.width, stripH);

  // Upscale 3x and increase contrast for better OCR
  const out = document.createElement('canvas');
  out.width = canvas.width * 3;
  out.height = stripH * 3;
  const outCtx = out.getContext('2d')!;
  outCtx.imageSmoothingEnabled = false;

  // Draw upscaled
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = stripH;
  tmp.getContext('2d')!.putImageData(imageData, 0, 0);
  outCtx.drawImage(tmp, 0, 0, out.width, out.height);

  // Apply contrast filter to make text pop
  outCtx.filter = 'contrast(200%) grayscale(100%)';
  outCtx.drawImage(tmp, 0, 0, out.width, out.height);

  return out;
}

/**
 * Parses set code and collector number from OCR'd bottom strip text.
 * MTG format examples:
 *   "123/456 IKO EN"  →  { setCode: 'iko', collectorNumber: '123' }
 *   "★123 SLD"        →  { setCode: 'sld', collectorNumber: '★123' }
 *   "042/264 · DMR"   →  { setCode: 'dmr', collectorNumber: '042' }
 */
export function parseSetCollector(text: string): { setCode: string; collectorNumber: string } | null {
  if (!text) return null;
  const clean = text.replace(/[^a-zA-Z0-9★/· \n]/g, ' ').replace(/\s+/g, ' ').trim();

  // Pattern: collector number (digits or ★+digits) followed by optional /total, then 2-6 letter set code
  const match = clean.match(/([★\*]?\d{1,4})(?:\/\d{1,4})?\s+·?\s*([A-Z]{2,6})\b/);
  if (match) {
    return { setCode: match[2].toLowerCase(), collectorNumber: match[1] };
  }

  // Alternate: set code appears before number (older cards)
  const altMatch = clean.match(/\b([A-Z]{2,6})\b.*?([★\*]?\d{1,4})(?:\/\d{1,4})?/);
  if (altMatch) {
    return { setCode: altMatch[1].toLowerCase(), collectorNumber: altMatch[2] };
  }

  return null;
}

/** OCR the bottom strip canvas, return raw text */
export async function ocrBottomStrip(stripCanvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const { createWorker } = await import('tesseract.js' as any);
    const worker = await createWorker('eng');
    // Bottom strip is short alphanumeric — restrict character set
    await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/·★* ' });
    const { data } = await worker.recognize(stripCanvas);
    await worker.terminate();
    return data.text.trim() || null;
  } catch {
    return null;
  }
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
  setCode: string | null,
  collectorNumber: string | null,
  nameOcrText: string | null,
): Promise<{ candidates: ScryfallCard[]; bestMatch: ScryfallCard | null; confidence: number; method: string }> {
  // ── PRIMARY: set code + collector number (exact Scryfall lookup) ──────────
  if (setCode && collectorNumber) {
    const card = await getCardBySetNumber(setCode, collectorNumber);
    if (card && !card.digital) {
      return { candidates: [card], bestMatch: card, confidence: 0.92, method: 'set+number' };
    }
  }

  // ── FALLBACK: name OCR → fuzzy search ────────────────────────────────────
  if (nameOcrText && nameOcrText.length > 2) {
    const byName = await getCardByName(nameOcrText);
    if (byName) {
      return { candidates: [byName], bestMatch: byName, confidence: 0.65, method: 'name-exact' };
    }
    const fuzzy = await searchCards(nameOcrText.substring(0, 24));
    if (fuzzy.length > 0) {
      return { candidates: fuzzy.slice(0, 5), bestMatch: fuzzy[0], confidence: 0.45, method: 'name-fuzzy' };
    }
  }

  return { candidates: [], bestMatch: null, confidence: 0, method: 'none' };
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

    // Run both OCR regions in parallel
    const nameImageData = extractNameRegion(detected.canvas);
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = nameImageData.width;
    nameCanvas.height = nameImageData.height;
    nameCanvas.getContext('2d')!.putImageData(nameImageData, 0, 0);

    const bottomCanvas = extractBottomRegion(detected.canvas);

    const [nameOcrText, bottomOcrText] = await Promise.all([
      ocrNameRegion(nameCanvas),
      ocrBottomStrip(bottomCanvas),
    ]);

    // Parse set+collector from bottom strip
    const parsed = bottomOcrText ? parseSetCollector(bottomOcrText) : null;

    const { candidates, bestMatch, confidence, method } = await matchCard(
      parsed?.setCode ?? null,
      parsed?.collectorNumber ?? null,
      nameOcrText,
    );

    // set+number hit → confirming; name hit → matching; nothing → detecting
    const status = confidence >= 0.9 ? 'confirming' : confidence >= 0.4 ? 'matching' : 'detecting';

    return {
      status,
      candidates,
      bestMatch,
      confidence,
      ocrText: nameOcrText ?? bottomOcrText ?? null,
      debugInfo: { method, bottomOcrText, parsed },
    } as ScanResult;
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
