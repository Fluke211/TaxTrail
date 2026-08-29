/*
 * TaxTrail — the pure half of restore-from-archive.
 *
 * Deciding *what* to import from an archive is ordinary data logic with no
 * device in it, so it lives here rather than inside restoreArchive(): a plain
 * CommonJS module the Node test harness can require directly, the same shape
 * classifier.js and exporters.js already use. exportShare.ts keeps the parts
 * that genuinely need the device — the file picker, the zip, the database.
 */
'use strict';

const C = require('./classifier.js');

// What a user would call "the same receipt". Deliberately NOT the id: SQLite
// reassigns ids on insert, so ids say nothing about identity across devices.
// Merchant is compared case- and whitespace-insensitively because it is OCR
// output; total is fixed to cents so 12.5 and 12.50 agree.
function fingerprint(r) {
  const merchant = String((r && r.merchant) || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const date = String((r && r.date) || '').slice(0, 10);
  const total = Number((r && r.total) || 0).toFixed(2);
  return `${merchant}|${date}|${total}`;
}

// Fill in whatever the archive did not carry. An older archive is still a valid
// archive: a missing field must produce an importable row, never a crash.
function normalizeRow(r, nowIso) {
  return {
    createdAt: (r && r.createdAt) || nowIso,
    merchant: (r && r.merchant) || '',
    date: String((r && r.date) || '').slice(0, 10),
    total: Number(r && r.total) || 0,
    // An archive exported before a category was renamed still carries the old
    // name, and it will keep arriving forever — archives are files people
    // keep. Mapping on the way in means an old backup lands under the current
    // name instead of quietly resurrecting a category that no longer exists
    // and would export with no TXF code at all.
    category: C.canonicalCategory((r && r.category) || ''),
    scheduleC: (r && r.scheduleC) || '',
    notes: (r && r.notes) || '',
    salesTax: r && r.salesTax != null ? r.salesTax : null,
    taxRate: r && r.taxRate != null ? r.taxRate : null,
    allocations: r && Array.isArray(r.allocations)
      ? r.allocations.map(function (a) {
        return a && a.category
          ? Object.assign({}, a, { category: C.canonicalCategory(a.category) })
          : a;
      })
      : [],
    confidence: (r && r.confidence) || '',
    ocrText: (r && r.ocrText) || '',
    imageFile: (r && r.imageFile) || null,
  };
}

/**
 * Work out which rows to add.
 *
 * `existing` is the set of fingerprints already on the device. Duplicates
 * *within* the archive are collapsed too, so a malformed export cannot insert
 * the same receipt twice — which is what makes restoring the same file twice a
 * genuine no-op rather than one that only holds for the first run.
 */
function planRestore(rows, existing, nowIso) {
  const seen = new Set(existing || []);
  const toImport = [];
  let skipped = 0;

  for (const raw of Array.isArray(rows) ? rows : []) {
    const fp = fingerprint(raw);
    if (seen.has(fp)) { skipped += 1; continue; }
    seen.add(fp);
    toImport.push(normalizeRow(raw, nowIso));
  }
  return { toImport, skipped };
}

module.exports = { fingerprint, normalizeRow, planRestore };
