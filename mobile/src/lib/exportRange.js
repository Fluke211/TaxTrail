/*
 * TaxTrail — which receipts an export covers, and what to call the file.
 *
 * Two problems, one module, because they are the same problem: the filename has
 * to say what the file contains, or a CPA with six exports in a folder cannot
 * tell them apart.
 *
 *   1. Every export was hardcoded to the CURRENT YEAR's label and ALL receipts.
 *      `taxtrail-2026.csv` claimed to be 2026 while containing every receipt
 *      ever scanned — so the first export that spans a year boundary is
 *      mislabelled, and last year's return cannot be exported at all.
 *   2. Exporting twice produced the same filename twice. iOS silently appends
 *      "(1)", so the two are distinguishable only by tap order.
 *
 * Everything here works on ISO `yyyy-mm-dd` STRINGS and compares them
 * lexicographically. That is deliberate: `new Date('2026-01-01')` parses as UTC
 * midnight, which is 2025-12-31 in every US timezone, so a Date-based year
 * filter drops January 1st receipts for anyone west of Greenwich. Strings have
 * no timezone to get wrong.
 */
'use strict';

/** Today as `yyyy-mm-dd` in the DEVICE's timezone, which is the one the user
 *  means when they say "this year". `toISOString()` would give UTC. */
function isoDay(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * Build a range descriptor.
 *
 *   makeRange('all')
 *   makeRange('ytd',    { now: new Date() })
 *   makeRange('year',   { year: 2025 })
 *   makeRange('custom', { from: '2026-01-01', to: '2026-06-30' })
 *
 * `from`/`to` are inclusive bounds, or null for unbounded.
 */
function makeRange(kind, opts) {
  var o = opts || {};
  var now = o.now || new Date();
  var thisYear = now.getFullYear();

  if (kind === 'ytd') {
    return {
      kind: 'ytd',
      from: thisYear + '-01-01',
      to: isoDay(now),
      label: thisYear + ' year to date',
      slug: thisYear + '-ytd',
    };
  }
  if (kind === 'year') {
    var y = Number(o.year);
    if (!isFinite(y)) throw new Error('makeRange("year") needs a year');
    return {
      kind: 'year',
      from: y + '-01-01',
      to: y + '-12-31',
      label: 'All of ' + y,
      slug: String(y),
    };
  }
  if (kind === 'custom') {
    var from = o.from || null;
    var to = o.to || null;
    // A backwards range selects nothing, which looks like a bug in the export
    // rather than a mis-set picker. Swapping is what the user meant.
    if (from && to && from > to) { var t = from; from = to; to = t; }
    return {
      kind: 'custom',
      from: from,
      to: to,
      label: (from || 'the beginning') + ' to ' + (to || 'today'),
      slug: (from || 'start') + '-to-' + (to || 'end'),
    };
  }
  return { kind: 'all', from: null, to: null, label: 'All receipts', slug: 'all' };
}

/** Is this receipt's date inside the range? */
function inRange(date, range) {
  var d = String(date || '').slice(0, 10);
  if (!d) return false;                       // undated: see filterByRange
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

/**
 * Split receipts into the ones the range covers and the ones it cannot place.
 *
 * A receipt with no date is not "outside 2025" — it is unplaceable, and quietly
 * dropping it from a tax export is the kind of silence that loses a deduction.
 * `all` keeps them (nothing is being claimed about dates); every bounded range
 * reports them separately so the UI can say so out loud.
 */
function filterByRange(receipts, range) {
  var list = receipts || [];
  if (range.kind === 'all') return { receipts: list.slice(), undated: [] };
  var kept = [];
  var undated = [];
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    if (!String(r && r.date || '').slice(0, 10)) undated.push(r);
    else if (inRange(r.date, range)) kept.push(r);
  }
  return { receipts: kept, undated: undated };
}

/**
 * `taxtrail-2025-exported-2026-08-30.csv`
 *
 * Coverage first so a folder sorts by tax year; the export date spelled out
 * with "exported" rather than merely appended, because `taxtrail-2025-2026-08-30`
 * reads as two ranges and nobody can tell which is which.
 */
function exportFileName(base, ext, range, now) {
  var stamp = isoDay(now || new Date());
  var slug = (range && range.slug) || 'all';
  return base + '-' + slug + '-exported-' + stamp + '.' + ext;
}

/** Years that actually have receipts, newest first — the picker offers these
 *  rather than a fixed "this year / last year", which would show a user their
 *  empty first January and hide a year they have data for. */
function yearsPresent(receipts) {
  var seen = {};
  var list = receipts || [];
  for (var i = 0; i < list.length; i++) {
    var d = String(list[i] && list[i].date || '').slice(0, 4);
    if (/^\d{4}$/.test(d)) seen[d] = true;
  }
  return Object.keys(seen).sort().reverse().map(Number);
}

module.exports = {
  isoDay: isoDay,
  makeRange: makeRange,
  inRange: inRange,
  filterByRange: filterByRange,
  exportFileName: exportFileName,
  yearsPresent: yearsPresent,
};
