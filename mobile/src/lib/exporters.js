/*
 * TaxTrail — export builders (CPA CSV, Excel workbook, TXF, QuickBooks CSV).
 * Shared between the web app and Node tests. Organized by IRS form:
 * Schedule C (by line number) → COGS → Form 8829 → Form 4562 → Schedule A → review → personal.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./classifier.js')); }
  else { root.ReceiptExporters = factory(root.ReceiptClassifier); }
}(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  // Excel (Windows) sniffs CSV as Windows-1252 unless a UTF-8 BOM leads the file.
  var BOM = '\uFEFF';
  // Belt & suspenders: use plain ASCII in export strings (em-dashes → hyphens).
  function ascii(s) { return String(s == null ? '' : s).replace(/[—–]/g, '-').replace(/[""]/g, '"').replace(/['']/g, "'"); }

  function toCSV(table) {
    return table.map(function (row) {
      return row.map(function (cell) {
        cell = ascii(cell);
        return /[",\n]/.test(cell) ? '"' + cell.replace(/"/g, '""') + '"' : cell;
      }).join(',');
    }).join('\r\n');
  }

  function sortRows(rows) {
    return rows.slice().sort(function (a, b) {
      var ka = C.formSortKey(a.category, a.sc), kb = C.formSortKey(b.category, b.sc);
      return ka[0] - kb[0] || ka[1] - kb[1] || a.category.localeCompare(b.category) || a.date.localeCompare(b.date);
    });
  }

  // ---------- CPA packet CSV ----------
  function buildCpaCSV(rows) {
    var table = [['Date', 'Merchant', 'Amount', 'Tax Form', 'Category', 'Form Line', 'Sales Tax Portion', 'Notes', 'Receipt ID', 'Split Part']];
    sortRows(rows).forEach(function (r) {
      table.push([r.date, r.merchant, r.amount.toFixed(2), C.taxFormOf(r.category), r.category, r.sc,
        r.taxPortion != null ? r.taxPortion.toFixed(2) : '', r.notes, r.rid, r.split]);
    });
    return BOM + toCSV(table);
  }

  // ---------- QuickBooks Online 3-column bank CSV ----------
  //
  // ONLINE only. QuickBooks Desktop cannot import bank transactions from CSV
  // at all — it wants Web Connect (.qbo) — so the label and filename say so.
  //
  // Date/Description/Amount is one of the two layouts Intuit documents ("Each
  // file needs either 3 (Date, Description, Amount) or 4 ... columns"), and the
  // header row uses their exact field names so the mapping step auto-resolves.
  // Negative for money out is their documented convention: the sample table
  // reads "Example of a payment / -100.00" against "Example of a deposit /
  // 200.00".
  //
  // The date is MM/DD/YYYY, which QuickBooks accepts but does NOT default to —
  // its own guidance recommends dd/mm/yyyy. For days 1-12 both readings are
  // valid and the import succeeds silently wrong, so the export screen tells
  // the user to set the format at the mapping step. That warning is the
  // load-bearing part; a wrong BOM fails loudly, a wrong date format does not.
  function buildQBO(rows) {
    var table = [['Date', 'Description', 'Amount']];
    rows.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (r) {
      var mmddyyyy = r.date ? (r.date.slice(5, 7) + '/' + r.date.slice(8, 10) + '/' + r.date.slice(0, 4)) : '';
      var desc = r.merchant + ' - ' + r.category + (r.notes ? ' - ' + r.notes : '');
      table.push([mmddyyyy, desc, (-r.amount).toFixed(2)]);
    });
    // No BOM here, deliberately. The BOM on the CPA CSV exists because that
    // file gets opened in Excel, which otherwise sniffs it as Windows-1252.
    // Nobody opens this one — it goes straight into QuickBooks' parser, where
    // a leading BOM can only ever be read as part of the first header name.
    return toCSV(table);
  }

  // ---------- TXF v042 (TurboTax Desktop / H&R Block / TaxAct) ----------
  //
  // Refnums that use Record Format 3 ("$ amount / P description") rather than
  // format 1 ("$ amount"). The Frm column of the v042 refnum table is the
  // authority; 302 is the only one TaxTrail emits:
  //
  //   2 302  "Other business expense"   Y   C   E   3   2011:C:27
  //   2 304  "Advertising"              Y   N   E   1   2011:C:8
  //                                                 ^ Frm
  //
  // The changelog records the move explicitly: "RNum 302 changed to Record
  // Format 3". Schedule C line 27 is itemized in Part V, and P is the field
  // that carries each item's description — which is why 302 needs it and the
  // single-line codes do not.
  var TXF_FORMAT_3 = { 302: true };

  // Expense refnums carry Sgn=E, so the normal sign is "-". Negating the sum
  // rather than prefixing a literal "-" matters because a category total CAN
  // be negative: CaptureScreen stores the split remainder as
  // total - sum(allocations) with no cap, so a $50 receipt split into two $30
  // parts saves a -$10 allocation. String concatenation then emitted
  // "$--10.00", a malformed record that an importer has no way to read.
  //
  // Negating also gives the right answer for that case rather than merely a
  // well-formed one: a category that nets to a credit belongs on the expense
  // line as a positive number, which is the same thing GnuCash does when it
  // calls gnc-numeric-neg on the way out.
  function txfAmount(sum) {
    var v = -Number(sum);
    if (!isFinite(v)) v = 0;
    // "-0.00" is not a number any importer should have to interpret.
    return '$' + (v === 0 ? 0 : v).toFixed(2);
  }

  function buildTXF(rows, exportDate, appVersion) {
    var byCode = {}, skipped = 0;
    rows.forEach(function (r) {
      if (C.taxFormOf(r.category) !== 'Schedule C') { skipped++; return; }
      var code = C.TXF_CODES[r.category];
      if (!code) { skipped++; return; }
      byCode[code] = byCode[code] || { sum: 0, byCat: {} };
      byCode[code].sum += r.amount;
      byCode[code].byCat[r.category] = (byCode[code].byCat[r.category] || 0) + r.amount;
    });

    // Zero-padded MM/DD/YYYY. The v035 changelog changed the header export date
    // to mm/dd/yyyy and the spec's own example is "D 08/20/2011"; the previous
    // "D9/1/2026" matched neither.
    var d = exportDate || new Date();
    var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var ds = p2(d.getMonth() + 1) + '/' + p2(d.getDate()) + '/' + d.getFullYear();
    // "A" is defined as which program *including version* wrote the file.
    var out = ['V042', 'A' + ascii('TaxTrail' + (appVersion ? ' ' + appVersion : '')), 'D' + ds, '^'];

    Object.keys(byCode).sort(function (a, b) { return a - b; }).forEach(function (code) {
      var entry = byCode[code];
      if (TXF_FORMAT_3[code]) {
        // One record per category, each with its own P line and its own L,
        // matching the spec's own format-3 example (N287 on L1 and L2). The
        // previous output merged every "other" category into a single record
        // and put their names in an X line, which lost the Part V itemization
        // the format exists to carry.
        Object.keys(entry.byCat).sort().forEach(function (cat, i) {
          out.push('TS', 'N' + code, 'C1', 'L' + (i + 1),
            txfAmount(entry.byCat[cat]), 'P' + ascii(cat), '^');
        });
      } else {
        // Format 1 is exactly T, N, C, L, $. No X: the spec only ever shows X
        // on TD detail records, where it is a fixed-column layout beginning
        // with a space and a date — a bare category name there is text sitting
        // where an importer expects a date.
        out.push('TS', 'N' + code, 'C1', 'L1', txfAmount(entry.sum), '^');
      }
    });
    return { content: out.join('\r\n') + '\r\n', codes: Object.keys(byCode).length, skipped: skipped };
  }

  // NOTE: an ExcelJS `buildWorkbook` used to live here, carried over from the
  // PWA. It was never reachable from the app — exceljs does not work under
  // React Native (CLAUDE.md), so the real .xlsx is built by src/lib/xlsxExport.ts
  // with SheetJS. Removed rather than left to look like a supported path.

  return {
    buildCpaCSV: buildCpaCSV,
    buildQBO: buildQBO,
    buildTXF: buildTXF,
    sortRows: sortRows
  };
}));

