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
  function buildQBO(rows) {
    var table = [['Date', 'Description', 'Amount']];
    rows.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (r) {
      var mmddyyyy = r.date ? (r.date.slice(5, 7) + '/' + r.date.slice(8, 10) + '/' + r.date.slice(0, 4)) : '';
      var desc = r.merchant + ' - ' + r.category + (r.notes ? ' - ' + r.notes : '');
      table.push([mmddyyyy, desc, (-r.amount).toFixed(2)]);
    });
    return BOM + toCSV(table);
  }

  // ---------- TXF v042 (TurboTax Desktop / H&R Block / TaxAct) ----------
  function buildTXF(rows, exportDate) {
    var byCode = {}, skipped = 0;
    rows.forEach(function (r) {
      if (C.taxFormOf(r.category) !== 'Schedule C') { skipped++; return; }
      var code = C.TXF_CODES[r.category];
      if (!code) { skipped++; return; }
      byCode[code] = byCode[code] || { sum: 0, cats: {} };
      byCode[code].sum += r.amount;
      byCode[code].cats[r.category] = true;
    });
    var d = exportDate || new Date();
    var ds = (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
    var out = ['V042', 'ATaxTrail', 'D' + ds, '^'];
    Object.keys(byCode).sort(function (a, b) { return a - b; }).forEach(function (code) {
      out.push('TS', 'N' + code, 'C1', 'L1', '$-' + byCode[code].sum.toFixed(2),
        'X' + ascii(Object.keys(byCode[code].cats).join('; ')), '^');
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

