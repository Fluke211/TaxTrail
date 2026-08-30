// Export builders → file in the cache dir → iOS share sheet.
// CSV/TXF/QBO come verbatim from exporters.js (shared with the PWA + tests).
// XLSX is built with SheetJS (pure JS, Hermes-safe) — see xlsxExport.ts.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { addReceipt, allReceipts, type Receipt } from './db';
import { exportRows } from './rows';
import { buildXlsxBase64 } from './xlsxExport';
import { saveRestoredImage } from './ocr';
import { APP_VERSION, JS_REVISION } from './version';
import { makeRange, filterByRange, exportFileName, type ExportRange } from './exportRange';
const X = require('./exporters.js');
const R = require('./restorePlan.js');
const E = require('./edited.js');

// Exports that predate range selection, and the ones where a range makes no
// sense (a backup is a backup), use this.
const ALL: ExportRange = makeRange('all');

/**
 * Every range-aware export narrows its own input.
 *
 * Deliberately not the caller's job: the range decides both which rows go in
 * the file and what the file is called, and a caller that passed the range for
 * the filename but forgot to filter would produce a file labelled "All of 2025"
 * containing every receipt ever scanned — which is the exact bug this feature
 * exists to fix, reintroduced one layer up.
 */
function scope(receipts: Receipt[], range: ExportRange): Receipt[] {
  return filterByRange(receipts, range).receipts;
}

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

export async function exportCSV(receipts: Receipt[], range: ExportRange = ALL): Promise<void> {
  const csv: string = X.buildCpaCSV(exportRows(scope(receipts, range)));
  await shareText(exportFileName('taxtrail', 'csv', range), csv, 'text/csv');
}

export async function exportTXF(receipts: Receipt[], range: ExportRange = ALL): Promise<void> {
  // The TXF "A" record is defined as which program *including version*
  // wrote the file, so a CPA opening it can tell which build produced it.
  const txf = X.buildTXF(exportRows(scope(receipts, range)), new Date(), `${APP_VERSION} r${JS_REVISION}`);
  await shareText(exportFileName('taxtrail', 'txf', range), txf.content, 'application/octet-stream');
}

export async function exportQBO(receipts: Receipt[], range: ExportRange = ALL): Promise<void> {
  const qbo: string = X.buildQBO(exportRows(scope(receipts, range)));
  // "-online-" is not cosmetic: QuickBooks Desktop cannot import bank
  // transactions from CSV, so a Desktop user downloading this would be stuck.
  await shareText(exportFileName('taxtrail-quickbooks-online', 'csv', range), qbo, 'text/csv');
}

export async function exportXLSX(receipts: Receipt[], range: ExportRange = ALL): Promise<void> {
  const b64 = buildXlsxBase64(exportRows(scope(receipts, range)), range.label);
  await shareBase64(
    exportFileName('taxtrail', 'xlsx', range), b64,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

/**
 * Parser diagnostics: the raw Apple Vision output for every receipt, next to
 * what the classifier made of it.
 *
 * Parser bugs can only be found on real receipts — synthetic images do not
 * reproduce thermal fade, curl or glare. This is the handoff: one tap here
 * turns a scanning session into regression fixtures, and every step after
 * capture (fixtures, fixes, scoring) can then be automated.
 *
 * Contains receipt text, so it goes through the share sheet like everything
 * else — the user chooses where it goes, and nothing is uploaded.
 */
export async function exportDiagnostics(receipts: Receipt[]): Promise<void> {
  const rows = receipts.map((r) => {
    const snapshot = E.readSnapshot(r.parsedSnapshot ?? null);
    const changed = E.changedFields(snapshot, r);
    return {
      id: r.id,
      // `stored` is the truth as the user left it; `parserSaid` is what the
      // classifier produced. Where they differ, the pair IS the fixture — the
      // OCR text plus the right answer, which is everything a regression test
      // for a parser bug needs.
      stored: {
        merchant: r.merchant, date: r.date, total: r.total,
        salesTax: r.salesTax, taxRate: r.taxRate,
        category: r.category, scheduleC: r.scheduleC,
        confidence: r.confidence,
      },
      parserSaid: snapshot,
      edited: E.wasEdited(snapshot, r),   // null = scanned before snapshots
      editedFields: changed,
      ocrText: r.ocrText,
    };
  });

  const corrected = rows.filter((r) => r.edited === true).length;
  const unknown = rows.filter((r) => r.edited === null).length;

  const payload = {
    app: 'TaxTrail',
    kind: 'parser-diagnostics',
    // v2 adds parserSaid / edited / editedFields. v1 called `stored` `parsed`,
    // which was a misnomer even then: it was always the post-edit values.
    version: 2,
    exportedAt: new Date().toISOString(),
    count: rows.length,
    summary: {
      corrected,
      unedited: rows.length - corrected - unknown,
      // Rows from before the snapshot column existed. Counted separately
      // rather than folded into "unedited", which would claim the parser got
      // them right — the one thing there is no evidence for.
      unknown,
    },
    receipts: rows,
  };
  await shareText(
    `taxtrail-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(payload, null, 1),
    'application/json',
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
export async function exportArchive(receipts: Receipt[], range: ExportRange = ALL): Promise<void> {
  const JSZip = require('jszip');
  const zip = new JSZip();
  const images = zip.folder('images');

  // A ranged archive is a legitimate thing to want — one year's substantiation
  // for one year's return — but it is NOT a backup, and the README below says
  // so in as many words. Handing someone a file that says "keep this somewhere
  // durable" when it holds nine months of receipts would be the worst possible
  // way to be helpful.
  const scoped = scope(receipts, range);

  let withImages = 0;
  const manifest = await Promise.all(scoped.map(async (r, i) => {
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
  const partial = range.kind !== 'all';
  zip.file('backup.json', JSON.stringify({
    app: 'TaxTrail', version: 3, exportedAt: new Date().toISOString(),
    coverage: { kind: range.kind, from: range.from, to: range.to, label: range.label },
    receiptCount: manifest.length, imageCount: withImages,
    receipts: manifest,
  }, null, 1));
  zip.file('receipts.csv', X.buildCpaCSV(exportRows(scoped)));
  zip.file('README.txt',
    `TaxTrail archive — ${stamp}\n\n` +
    `Covers: ${range.label}\n` +
    `${manifest.length} receipts, ${withImages} images.\n\n` +
    `images/     the receipt photographs\n` +
    `receipts.csv  the same data as a spreadsheet, organized by IRS form\n` +
    `backup.json   full records; each entry's "imageFile" names its image\n\n` +
    (partial
      ? `THIS IS NOT A FULL BACKUP. It holds ${range.label.toLowerCase()} only.\n` +
        `For everything on the device, export an archive with the range set to\n` +
        `"All receipts".\n\n`
      : ``) +
    `Everything in it was produced on your device — TaxTrail has no servers\n` +
    `and never uploaded any of it.\n`);

  const b64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  await shareBase64(exportFileName('taxtrail-archive', 'zip', range), b64, 'application/zip');
}

// Full JSON backup (same v2 schema family as the PWA backup).
// Data only — image paths in here go stale on reinstall. Use exportArchive for
// anything meant to outlive the current install.
export async function exportBackup(receipts: Receipt[]): Promise<void> {
  const payload = JSON.stringify({ app: 'TaxTrail', version: 2, exportedAt: new Date().toISOString(), receipts }, null, 1);
  await shareText(`taxtrail-backup-${new Date().toISOString().slice(0, 10)}.json`, payload, 'application/json');
}

/**
 * Read an archive back in.
 *
 * The counterpart to exportArchive, and the thing that makes the export a
 * backup rather than a souvenir: until this existed, an archive could leave the
 * phone but never return (D-016). Restoring is what a new phone, a reinstall,
 * or a restored-from-iCloud device needs.
 *
 * **Re-importing the same archive is a no-op.** Rows are fingerprinted on
 * merchant + date + total, so a user who restores twice — or restores onto a
 * device that already has some of these receipts — gets the missing ones and no
 * duplicates. The fingerprint deliberately ignores id: ids are reassigned by
 * SQLite on insert and say nothing about whether two rows are the same receipt.
 *
 * Everything happens on device. The picker hands back a file URL; nothing is
 * uploaded, and no permission prompt is involved (the iOS document picker is a
 * system UI that grants access to exactly the file chosen).
 */
// expo-document-picker is a native module, so it exists only in a build that
// was compiled with it. JS ships over the air and can therefore land on an older
// binary — so ask, rather than assume, and let the UI hide the control instead of
// offering one that cannot work.
function documentPicker(): any | null {
  try {
    const m = require('expo-document-picker');
    return typeof m?.getDocumentAsync === 'function' ? m : null;
  } catch {
    return null;
  }
}

export function isRestoreAvailable(): boolean {
  return documentPicker() != null;
}

export interface RestoreResult {
  imported: number;
  skipped: number;
  images: number;
  imagesMissing: number;
}

export async function restoreArchive(): Promise<RestoreResult | null> {
  const DocumentPicker = documentPicker();
  if (!DocumentPicker) {
    throw new Error('Restore needs the newest version of the app. Update from the App Store, then try again.');
  }
  // `type` is a MIME type: the iOS module maps it with UTType(mimeType:), which
  // turns application/zip into public.zip-archive. A UTI passed here is silently
  // dropped by compactMap, so do not pass one.
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/zip',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.length) return null;

  const b64 = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(b64, { base64: true });

  const entry = zip.file('backup.json');
  if (!entry) {
    throw new Error("That zip has no backup.json — it is not a TaxTrail archive.");
  }
  const payload = JSON.parse(await entry.async('string'));
  const rows: any[] = Array.isArray(payload?.receipts) ? payload.receipts : [];
  if (!rows.length) return { imported: 0, skipped: 0, images: 0, imagesMissing: 0 };

  const existing = new Set((await allReceipts()).map(R.fingerprint));
  const { toImport, skipped } = R.planRestore(rows, existing, new Date().toISOString());

  const result: RestoreResult = { imported: 0, skipped, images: 0, imagesMissing: 0 };

  for (let i = 0; i < toImport.length; i++) {
    const { imageFile, ...row } = toImport[i];

    let imagePath: string | null = null;
    let thumbPath: string | null = null;
    if (imageFile) {
      const img = zip.file(`images/${imageFile}`);
      if (img) {
        try {
          const saved = await saveRestoredImage(await img.async('base64'), i);
          imagePath = saved.imagePath;
          thumbPath = saved.thumbPath;
          result.images += 1;
        } catch {
          // An image that will not write must not cost the row it belongs to —
          // the data is the tax record; the photo is the substantiation.
          result.imagesMissing += 1;
        }
      } else {
        result.imagesMissing += 1;
      }
    }

    await addReceipt({ ...row, imagePath, thumbPath });
    result.imported += 1;
  }

  return result;
}
