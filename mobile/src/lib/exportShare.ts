// Export builders → file in the cache dir → iOS share sheet.
// CSV/TXF/QBO come verbatim from exporters.js (shared with the PWA + tests).
// XLSX is built with SheetJS (pure JS, Hermes-safe) — see xlsxExport.ts.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Receipt } from './db';
import { exportRows } from './rows';
import { buildXlsxBase64 } from './xlsxExport';
const X = require('./exporters.js');

async function shareText(filename: string, content: string, mimeType: string): Promise<void> {
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType, dialogTitle: filename });
}

async function shareBase64(filename: string, b64: string, mimeType: string): Promise<void> {
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, { mimeType, dialogTitle: filename });
}

const year = () => String(new Date().getFullYear());

export async function exportCSV(receipts: Receipt[]): Promise<void> {
  const csv: string = X.buildCpaCSV(exportRows(receipts));
  await shareText(`receiptsnap-${year()}.csv`, csv, 'text/csv');
}

export async function exportTXF(receipts: Receipt[]): Promise<void> {
  const txf = X.buildTXF(exportRows(receipts), new Date());
  await shareText(`receiptsnap-${year()}.txf`, txf.content, 'application/octet-stream');
}

export async function exportQBO(receipts: Receipt[]): Promise<void> {
  const qbo: string = X.buildQBO(exportRows(receipts));
  await shareText(`receiptsnap-quickbooks-${year()}.csv`, qbo, 'text/csv');
}

export async function exportXLSX(receipts: Receipt[]): Promise<void> {
  const b64 = buildXlsxBase64(exportRows(receipts), year());
  await shareBase64(
    `receiptsnap-${year()}.xlsx`, b64,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

// Filename-safe, human-browsable name: 0007-costco-2026-08-02.jpg
function imageFileName(r: Receipt, i: number): string {
  const slug = (r.merchant || 'receipt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  return `${String(r.id ?? i).padStart(4, '0')}-${slug || 'receipt'}-${(r.date || '').slice(0, 10)}.jpg`;
}

/**
 * Complete archive: the receipt images plus the data, in one file the user can
 * put wherever they like.
 *
 * This is what makes it safe to throw away the paper. The IRS accepts electronic
 * records (Rev. Proc. 97-22) provided the system can reproduce legible copies on
 * demand — which means the images have to be able to leave the phone. Every other
 * export here is data-only, and the JSON backup records image *paths*, which go
 * stale the moment the app is reinstalled.
 *
 * JPEGs are stored uncompressed inside the zip: they are already compressed, so
 * deflating them costs CPU and saves nothing. Note this holds the whole archive
 * in memory; very large libraries may need chunking.
 */
export async function exportArchive(receipts: Receipt[]): Promise<void> {
  const JSZip = require('jszip');
  const zip = new JSZip();
  const images = zip.folder('images');

  let withImages = 0;
  const manifest = await Promise.all(receipts.map(async (r, i) => {
    let imageFile: string | null = null;
    if (r.imagePath) {
      try {
        const b64 = await FileSystem.readAsStringAsync(r.imagePath, { encoding: FileSystem.EncodingType.Base64 });
        imageFile = imageFileName(r, i);
        images.file(imageFile, b64, { base64: true, compression: 'STORE' });
        withImages += 1;
      } catch {
        // A missing file must not lose the row it belongs to.
      }
    }
    return { ...r, imageFile };
  }));

  const stamp = new Date().toISOString().slice(0, 10);
  zip.file('backup.json', JSON.stringify({
    app: 'ReceiptSnap', version: 3, exportedAt: new Date().toISOString(),
    receiptCount: manifest.length, imageCount: withImages,
    receipts: manifest,
  }, null, 1));
  zip.file('receipts.csv', X.buildCpaCSV(exportRows(receipts)));
  zip.file('README.txt',
    `ReceiptSnap archive — ${stamp}\n\n` +
    `${manifest.length} receipts, ${withImages} images.\n\n` +
    `images/     the receipt photographs\n` +
    `receipts.csv  the same data as a spreadsheet, organized by IRS form\n` +
    `backup.json   full records; each entry's "imageFile" names its image\n\n` +
    `Keep this file somewhere durable. Everything in it was produced on your\n` +
    `device — ReceiptSnap has no servers and never uploaded any of it.\n`);

  const b64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  await shareBase64(`receiptsnap-archive-${stamp}.zip`, b64, 'application/zip');
}

// Full JSON backup (same v2 schema family as the PWA backup).
// Data only — image paths in here go stale on reinstall. Use exportArchive for
// anything meant to outlive the current install.
export async function exportBackup(receipts: Receipt[]): Promise<void> {
  const payload = JSON.stringify({ app: 'ReceiptSnap', version: 2, exportedAt: new Date().toISOString(), receipts }, null, 1);
  await shareText(`receiptsnap-backup-${new Date().toISOString().slice(0, 10)}.json`, payload, 'application/json');
}
