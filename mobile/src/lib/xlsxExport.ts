// Real .xlsx via SheetJS (pure JS — Hermes-safe). Mirrors the PWA workbook's
// structure: Summary (grouped by IRS form) / Schedule C / Other Forms + Personal.
// (The PWA's ExcelJS data-bar formatting isn't supported by SheetJS CE; the
// numbers and organization are identical.)
import * as XLSX from 'xlsx';
import type { ExportRow } from './exporters';
const C = require('./classifier.js');

export function buildXlsxBase64(rows: ExportRow[], yearLabel: string): string {
  const wb = XLSX.utils.book_new();

  // ---- Summary: category totals grouped by tax form ----
  const byCat = new Map<string, { total: number; count: number; sc: string }>();
  for (const r of rows) {
    const e = byCat.get(r.category) || { total: 0, count: 0, sc: r.sc };
    e.total += r.amount; e.count += 1;
    byCat.set(r.category, e);
  }
  const cats = [...byCat.entries()].sort((a, b) => {
    const ka = C.formSortKey(a[0], a[1].sc), kb = C.formSortKey(b[0], b[1].sc);
    return ka[0] - kb[0] || ka[1] - kb[1] || b[1].total - a[1].total;
  });

  const summary: (string | number)[][] = [
    [`ReceiptSnap — Tax Year ${yearLabel}`], [],
    ['Category', 'Tax Form', 'Entries', 'Total'],
  ];
  let currentForm = '';
  for (const [name, e] of cats) {
    const form = C.taxFormOf(name);
    if (form !== currentForm) {
      currentForm = form;
      summary.push([]);
      summary.push([form.toUpperCase()]);
    }
    summary.push([name, e.sc, e.count, Math.round(e.total * 100) / 100]);
  }
  // Sales tax paid section (Schedule A line 5a support)
  const stBiz = rows.filter(r => r.business && r.taxPortion).reduce((s, r) => s + (r.taxPortion || 0), 0);
  const stPersonal = rows.filter(r => !r.business && r.taxPortion).reduce((s, r) => s + (r.taxPortion || 0), 0);
  summary.push([], ['SALES TAX PAID'],
    ['On business purchases', '', '', Math.round(stBiz * 100) / 100],
    ['On personal purchases (Schedule A line 5a)', '', '', Math.round(stPersonal * 100) / 100]);
  summary.push([], ['Import tip: FreeTaxUSA/TurboTax — enter each Schedule C line total directly.']);

  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 46 }, { wch: 9 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, `Summary ${yearLabel}`);

  // ---- Transaction tabs ----
  const header = ['Date', 'Merchant', 'Amount', 'Tax Form', 'Category', 'Form Line', 'Sales Tax Portion', 'Notes', 'Receipt ID', 'Split Part'];
  const toRow = (r: ExportRow) => [r.date, r.merchant, r.amount, C.taxFormOf(r.category), r.category, r.sc, r.taxPortion ?? '', r.notes, r.rid, r.split];

  const schedC = rows.filter(r => C.taxFormOf(r.category) === 'Schedule C');
  const other = rows.filter(r => C.taxFormOf(r.category) !== 'Schedule C');

  const wsC = XLSX.utils.aoa_to_sheet([header, ...schedC.map(toRow)]);
  wsC['!cols'] = header.map((h, i) => ({ wch: i === 1 || i === 4 || i === 5 ? 30 : 13 }));
  wsC['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: schedC.length, c: header.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, wsC, 'Schedule C');

  const wsO = XLSX.utils.aoa_to_sheet([header, ...other.map(toRow)]);
  wsO['!cols'] = wsC['!cols'];
  wsO['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: other.length, c: header.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, wsO, 'Other Forms + Personal');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
