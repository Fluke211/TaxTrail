// On-device OCR pipeline: downscale the photo, run Apple Vision text recognition
// (via expo-text-extractor), and persist the processed JPEG + thumbnail into the
// app's documents directory. Nothing ever leaves the device.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { extractTextFromImage } from 'expo-text-extractor';
import * as FileSystem from 'expo-file-system/legacy';
import { RECEIPTS_DIR, resolveImage } from './images';

/*
 * Absolute, and only ever used to WRITE a file in this launch. What goes into
 * the database is the relative form. See paths.js.
 *
 * Reading it throws off-device rather than producing a path built from the
 * string "null". This module cannot do its job without a documents directory,
 * and an app that scans receipts has one.
 */
function dir(): string {
  if (!RECEIPTS_DIR) throw new Error('No documents directory on this platform');
  return RECEIPTS_DIR;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir());
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir(), { intermediates: true });
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

  const imagePath = `${dir()}${stamp}.jpg`;
  const thumbPath = `${dir()}${stamp}-thumb.jpg`;
  await FileSystem.copyAsync({ from: storedUri, to: imagePath });
  await FileSystem.copyAsync({ from: thumbUri, to: thumbPath });

  /*
   * The ABSOLUTE path goes into the database, deliberately, for now.
   *
   * The relative form is the right end state, and `resolveImage` already reads
   * both — but it is the newest JS that understands it, and expo-updates can
   * drop a phone back onto build 6's embedded r28, which cannot. Writing the
   * old form keeps every live bundle able to read what this one wrote, at no
   * cost: a stale absolute path is repaired on the way out.
   *
   * Writes switch to `storeImage()` once a binary embeds r30 or later. See
   * D-075 and ROADMAP.
   */
  return { text, imagePath, thumbPath };
}

export async function processReceiptPhoto(sourceUri: string): Promise<OcrResult> {
  return processReceiptPages([sourceUri]);
}

// Restore path: an archived JPEG comes back as base64 with no thumbnail — the
// archive stores the full image only. Write it into the documents directory the
// same way a fresh capture would, and regenerate the 200px thumbnail so the
// receipt list has something to show. `seq` keeps names unique inside one
// restore, since Date.now() does not move between iterations.
export async function saveRestoredImage(base64: string, seq: number): Promise<{ imagePath: string; thumbPath: string }> {
  await ensureDir();
  const stamp = `${Date.now()}-${String(seq).padStart(4, '0')}`;
  const imagePath = `${dir()}${stamp}.jpg`;
  await FileSystem.writeAsStringAsync(imagePath, base64, { encoding: FileSystem.EncodingType.Base64 });

  let thumbPath = imagePath;
  try {
    const thumbUri = await resizeTo(imagePath, 200, 0.7);
    thumbPath = `${dir()}${stamp}-thumb.jpg`;
    await FileSystem.copyAsync({ from: thumbUri, to: thumbPath });
  } catch {
    // A thumbnail that will not render is not worth losing the receipt over;
    // fall back to the full image, which the list can still display.
    thumbPath = imagePath;
  }
  // Absolute, for the reason given in processReceiptPages.
  return { imagePath, thumbPath };
}

export async function deleteReceiptFiles(r: { imagePath: string | null; thumbPath: string | null }): Promise<void> {
  // Resolved, not used as stored: a row written before build 6 holds a path
  // under a container that no longer exists, and deleting that would silently
  // leave the real file behind.
  for (const p of [resolveImage(r.imagePath), resolveImage(r.thumbPath)]) {
    if (p) { try { await FileSystem.deleteAsync(p, { idempotent: true }); } catch {} }
  }
}
