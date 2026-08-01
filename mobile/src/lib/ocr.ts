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

export async function processReceiptPhoto(sourceUri: string): Promise<OcrResult> {
  await ensureDir();
  const stamp = Date.now();

  // Working copy: 1600px wide is the OCR sweet spot (detail vs speed).
  const ocrUri = await resizeTo(sourceUri, 1600, 0.92);

  // Apple Vision returns recognized strings in reading order.
  const lines = await extractTextFromImage(ocrUri);
  const text = (lines || []).join('\n');

  // Stored record: 1200px JPEG + 200px thumbnail.
  const storedUri = await resizeTo(sourceUri, 1200, 0.85);
  const thumbUri = await resizeTo(sourceUri, 200, 0.7);

  const imagePath = `${DIR}${stamp}.jpg`;
  const thumbPath = `${DIR}${stamp}-thumb.jpg`;
  await FileSystem.copyAsync({ from: storedUri, to: imagePath });
  await FileSystem.copyAsync({ from: thumbUri, to: thumbPath });

  return { text, imagePath, thumbPath };
}

export async function deleteReceiptFiles(r: { imagePath: string | null; thumbPath: string | null }): Promise<void> {
  for (const p of [r.imagePath, r.thumbPath]) {
    if (p) { try { await FileSystem.deleteAsync(p, { idempotent: true }); } catch {} }
  }
}
