// On-device OCR pipeline: downscale the photo, run Apple Vision text recognition
// (via expo-text-extractor), and persist the processed JPEG + thumbnail into the
// app's documents directory. Nothing ever leaves the device.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { extractTextFromImage } from 'expo-text-extractor';
import * as FileSystem from 'expo-file-system/legacy';

const DIR = `${FileSystem.documentDirectory}receipts/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

async function resizeTo(uri: string, width: number, compress: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ compress, format: SaveFormat.JPEG });
  return result.uri;
}

export interface OcrResult {
  text: string;
  imagePath: string;
  thumbPath: string;
}

// Multi-page capture: a long receipt can exceed one frame, so VisionKit hands
// back several images. OCR each in order and join the text — the classifier
// consumes one newline-delimited blob, so a two-page receipt parses as one.
// The first page is what gets stored and displayed (the schema holds one image
// per receipt; storing every page needs a migration — see ROADMAP).
export async function processReceiptPages(sourceUris: string[]): Promise<OcrResult> {
  await ensureDir();
  const stamp = Date.now();

  const pages: string[] = [];
  for (const uri of sourceUris) {
    // Working copy: 1600px wide is the OCR sweet spot (detail vs speed).
    const ocrUri = await resizeTo(uri, 1600, 0.92);
    // Apple Vision returns recognized strings in reading order.
    const lines = await extractTextFromImage(ocrUri);
    pages.push((lines || []).join('\n'));
  }
  const text = pages.join('\n');

  // Stored record: 1200px JPEG + 200px thumbnail, from the first page.
  const primary = sourceUris[0];
  const storedUri = await resizeTo(primary, 1200, 0.85);
  const thumbUri = await resizeTo(primary, 200, 0.7);

  const imagePath = `${DIR}${stamp}.jpg`;
  const thumbPath = `${DIR}${stamp}-thumb.jpg`;
  await FileSystem.copyAsync({ from: storedUri, to: imagePath });
  await FileSystem.copyAsync({ from: thumbUri, to: thumbPath });

  return { text, imagePath, thumbPath };
}

export async function processReceiptPhoto(sourceUri: string): Promise<OcrResult> {
  return processReceiptPages([sourceUri]);
}

export async function deleteReceiptFiles(r: { imagePath: string | null; thumbPath: string | null }): Promise<void> {
  for (const p of [r.imagePath, r.thumbPath]) {
    if (p) { try { await FileSystem.deleteAsync(p, { idempotent: true }); } catch {} }
  }
}
