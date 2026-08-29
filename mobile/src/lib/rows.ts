// Export-row assembly — direct port of the PWA's exportRows()/allocationsOf()/
// isBusiness() so every export format produces byte-identical semantics.
import type { Receipt, Allocation } from './db';
import type { ExportRow } from './exporters';
const C = require('./classifier.js');
const P = require('./prorate.js');

const SC_BY_NAME: Record<string, string> = {};
const GROUP_BY_NAME: Record<string, string> = {};
for (const c of C.CATEGORIES as { name: string; scheduleC: string; group: string }[]) {
  SC_BY_NAME[c.name] = c.scheduleC;
  GROUP_BY_NAME[c.name] = c.group;
}
export { SC_BY_NAME, GROUP_BY_NAME };

export function isBusiness(cat: string): boolean {
  return GROUP_BY_NAME[cat] !== 'Not Schedule C';
}

export function allocationsOf(r: Receipt): Allocation[] {
  if (r.allocations && r.allocations.length) return r.allocations;
  return [{ category: r.category, scheduleC: r.scheduleC || SC_BY_NAME[r.category] || '', amount: r.total || 0 }];
}

export function exportRows(filtered: Receipt[]): ExportRow[] {
  const rows: ExportRow[] = [];
  filtered
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .forEach((r) => {
      const allocs = allocationsOf(r);
      const tot = r.total || allocs.reduce((s, a) => s + (a.amount || 0), 0) || 1;
      // Sales tax is split with the receipt, in whole cents, by the
      // largest-remainder method — so the parts sum to exactly the tax that was
      // paid. Rounding each part on its own lost a cent on some receipts and
      // INVENTED one on others, and sales tax feeds Schedule A line 5a, so an
      // over-reported figure is an over-claim on a filed return. See prorate.js.
      const taxParts: (number | null)[] = P.splitSalesTax(
        r.salesTax,
        allocs.map((a) => Math.round((a.amount || 0) * 100)),
        Math.round(tot * 100)
      );
      allocs.forEach((a, i) => {
        rows.push({
          date: r.date || '',
          merchant: r.merchant || '',
          amount: a.amount || 0,
          category: a.category,
          sc: a.scheduleC || SC_BY_NAME[a.category] || '',
          business: isBusiness(a.category),
          notes: r.notes || '',
          rid: 'R' + r.id,
          split: allocs.length > 1 ? `${i + 1} of ${allocs.length}` : '',
          taxPortion: taxParts[i],
        });
      });
    });
  return rows;
}
