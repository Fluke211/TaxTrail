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

// Full JSON backup (same v2 schema family as the PWA backup).
export async function exportBackup(receipts: Receipt[]): Promise<void> {
  const payload = JSON.stringify({ app: 'ReceiptSnap', version: 2, exportedAt: new Date().toISOString(), receipts }, null, 1);
  await shareText(`receiptsnap-backup-${new Date().toISOString().slice(0, 10)}.json`, payload, 'application/json');
}
