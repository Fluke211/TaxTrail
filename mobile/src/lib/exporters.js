/*
 * ReceiptSnap — export builders (CPA CSV, Excel workbook, TXF, QuickBooks CSV).
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
    var out = ['V042', 'AReceiptSnap', 'D' + ds, '^'];
    Object.keys(byCode).sort(function (a, b) { return a - b; }).forEach(function (code) {
      out.push('TS', 'N' + code, 'C1', 'L1', '$-' + byCode[code].sum.toFixed(2),
        'X' + ascii(Object.keys(byCode[code].cats).join('; ')), '^');
    });
    return { content: out.join('\r\n') + '\r\n', codes: Object.keys(byCode).length, skipped: skipped };
  }

  // ---------- Real .xlsx workbook (ExcelJS) ----------
  // Tabs: Summary (by IRS form, DIY-software entry guide) · Schedule C · Other Forms + Personal
  function buildWorkbook(ExcelJS, rows, year) {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'ReceiptSnap';
    var sorted = sortRows(rows);
    var HDR_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF5' } };
    var CUR = '"$"#,##0.00';

    function styleHeader(row) {
      row.font = { bold: true };
      row.eachCell(function (c) { c.fill = HDR_FILL; });
    }

    // --- Summary sheet ---
    var s = wb.addWorksheet('Summary' + (year ? ' ' + year : ''));
    s.columns = [
      { width: 34 }, { width: 40 }, { width: 8 }, { width: 14 }
    ];
    var byCat = {};
    sorted.forEach(function (r) {
      byCat[r.category] = byCat[r.category] || { sum: 0, n: 0, sc: r.sc, form: C.taxFormOf(r.category) };
      byCat[r.category].sum += r.amount; byCat[r.category].n++;
    });
    // group categories by form, in form order
    var forms = [];
    Object.keys(byCat).forEach(function (k) {
      var f = byCat[k].form;
      if (forms.indexOf(f) === -1) forms.push(f);
    });
    forms.sort(function (a, b) {
      function fk(f) { for (var k in byCat) if (byCat[k].form === f) return C.formSortKey(k, byCat[k].sc)[0]; return 9; }
      return fk(a) - fk(b);
    });
    styleHeader(s.addRow(['Category', 'Form Line', 'Count', 'Total']));
    forms.forEach(function (form) {
      var fr = s.addRow([form.toUpperCase()]);
      fr.font = { bold: true, color: { argb: 'FF4F7CFF' } };
      var cats = Object.keys(byCat).filter(function (k) { return byCat[k].form === form; })
        .sort(function (a, b) { return C.formSortKey(a, byCat[a].sc)[1] - C.formSortKey(b, byCat[b].sc)[1] || byCat[b].sum - byCat[a].sum; });
      var ft = 0;
      cats.forEach(function (k) {
        var c = byCat[k]; ft += c.sum;
        var row = s.addRow([k, ascii(c.sc), c.n, c.sum]);
        row.getCell(4).numFmt = CUR;
      });
      var tr = s.addRow([form + ' total', '', '', ft]);
      tr.font = { bold: true };
      tr.getCell(4).numFmt = CUR;
      s.addRow([]);
    });
    // --- Visual Summary sheet: %-of-group with in-cell data bars ---
    // (Native embedded pie charts can't be generated in-browser; Excel data bars
    // are a native feature and render as a bar chart inside the cells. Columns
    // A:B are pre-arranged so "Insert → Pie chart" works in one step.)
    var v = wb.addWorksheet('Visual Summary');
    v.columns = [{ width: 34 }, { width: 14 }, { width: 11 }, { width: 44 }];
    var vHdr = v.addRow(['Category', 'Total', '% of group', 'Spending bar']);
    styleHeader(vHdr);
    var vRanges = [];
    forms.forEach(function (form) {
      var cats = Object.keys(byCat).filter(function (k) { return byCat[k].form === form; })
        .sort(function (a, b) { return byCat[b].sum - byCat[a].sum; });
      if (!cats.length) return;
      var groupTotal = cats.reduce(function (t, k) { return t + byCat[k].sum; }, 0) || 1;
      var fr2 = v.addRow([form.toUpperCase()]);
      fr2.font = { bold: true, color: { argb: 'FF4F7CFF' } };
      var startRow = v.rowCount + 1;
      cats.forEach(function (k) {
        var row = v.addRow([k, byCat[k].sum, byCat[k].sum / groupTotal, byCat[k].sum]);
        row.getCell(2).numFmt = CUR;
        row.getCell(3).numFmt = '0.0%';
        row.getCell(4).numFmt = ';;;';       // hide the number — show only the data bar
      });
      vRanges.push('D' + startRow + ':D' + v.rowCount);
      v.addRow([]);
    });
    vRanges.forEach(function (ref) {
      v.addConditionalFormatting({
        ref: ref,
        rules: [{ type: 'dataBar', minLength: 0, maxLength: 100,
          cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF4F7CFF' }, gradient: false }]
      });
    });
    v.addRow(['Want a pie chart? Select a group\'s rows in columns A:B, then Insert → Chart → Pie.'])
      .font = { color: { argb: 'FF8A97AB' } };

    // Sales tax paid (Schedule A actual-expense method support)
    var stAll = 0, stBiz = 0, stOther = 0;
    sorted.forEach(function (r) {
      if (r.taxPortion == null) return;
      stAll += r.taxPortion;
      if (r.business) stBiz += r.taxPortion; else stOther += r.taxPortion;
    });
    if (stAll > 0) {
      var sth = s.addRow(['SALES TAX PAID']);
      sth.font = { bold: true, color: { argb: 'FF4F7CFF' } };
      [['Total sales tax recorded', stAll], ['On business portions (already inside Schedule C expenses)', stBiz],
       ['On personal / other portions (Schedule A line 5a candidate)', stOther]].forEach(function (p) {
        var row = s.addRow([p[0], '', '', Math.round(p[1] * 100) / 100]);
        row.getCell(4).numFmt = CUR;
      });
      s.addRow(['Itemizers may deduct ACTUAL sales tax paid instead of state income tax (Schedule A, line 5a).']).font = { color: { argb: 'FF8A97AB' } };
      s.addRow(['Only the personal-portion figure belongs there - business-portion tax is already deducted via Schedule C.']).font = { color: { argb: 'FF8A97AB' } };
      s.addRow([]);
    }
    s.addRow(['HOW TO USE THIS SHEET']).font = { bold: true };
    [
      'CPA: the Schedule C section above maps 1:1 to Schedule C expense lines.',
      'FreeTaxUSA / TurboTax / H&R Block online: in the self-employment expenses screens,',
      'enter each Schedule C line total above into the matching expense field.',
      'Schedule A items are personal itemized deductions - enter under Deductions & Credits.',
      'COGS, Home Office (8829) and Depreciation (4562) have their own interview sections.',
      'Not tax advice - confirm treatment with your tax professional.'
    ].forEach(function (t) { s.addRow([t]).font = { color: { argb: 'FF8A97AB' } }; });

    // --- transaction sheets ---
    function txSheet(name, rws, withForm) {
      var ws = wb.addWorksheet(name);
      var cols = [
        { width: 12 }, { width: 26 }, { width: 12 }, { width: 26 }, { width: 38 }, { width: 34 }, { width: 12 }
      ];
      if (withForm) cols.splice(3, 0, { width: 26 });
      ws.columns = cols;
      var hdr = ['Date', 'Merchant', 'Amount', 'Category', 'Form Line', 'Notes', 'Receipt'];
      if (withForm) hdr.splice(3, 0, 'Tax Form');
      styleHeader(ws.addRow(hdr));
      rws.forEach(function (r) {
        var vals = [r.date, r.merchant, r.amount, r.category, ascii(r.sc), r.notes, r.rid + (r.split ? ' (' + r.split + ')' : '')];
        if (withForm) vals.splice(3, 0, C.taxFormOf(r.category));
        var row = ws.addRow(vals);
        row.getCell(3).numFmt = CUR;
      });
      // Filter/sort dropdowns on the header row, out of the box
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hdr.length } };
      ws.views = [{ state: 'frozen', ySplit: 1 }];   // keep header visible when scrolling
      return ws;
    }
    var schedC = sorted.filter(function (r) { return C.taxFormOf(r.category) === 'Schedule C'; });
    var other = sorted.filter(function (r) { return C.taxFormOf(r.category) !== 'Schedule C'; });
    txSheet('Schedule C', schedC, false);
    txSheet('Other Forms + Personal', other, true);
    return wb;
  }

  return {
    buildCpaCSV: buildCpaCSV,
    buildQBO: buildQBO,
    buildTXF: buildTXF,
    buildWorkbook: buildWorkbook,
    sortRows: sortRows
  };
}));

