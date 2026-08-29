// Classifier regression tests for the mobile copy — run with `npm run test:unit`.
// Uses the same real-receipt fixtures as the PWA suite; guards against the
// mobile copy of classifier.js drifting from the web copy.
const fs = require('fs');
const path = require('path');
const C = require('../src/lib/classifier.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ← got: ' + extra}`);
}

const fx = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

// Costco #1: total beats "items sold" + instant savings
const r1 = C.parseReceipt(fx('costco-raw.txt'));
check('costco1 total 140.35', r1.total === 140.35, r1.total);

// Costco #2: OCR-garbled "$172{37" wins; FSA lines excluded from total AND tax
const r2 = C.parseReceipt(fx('costco2-raw.txt'));
check('costco2 total 172.37 (not FSA 16.99)', r2.total === 172.37, r2.total);
check('costco2 tax 7.16 (not FSA 16.99)', r2.taxTotal === 7.16, r2.taxTotal);
check('costco2 printed rate 4.712%', Math.abs(r2.taxRatePrinted - 0.04712) < 1e-6, r2.taxRatePrinted);

// Safeway: double-column item lines
const r3 = C.parseReceipt(fx('safeway-raw.txt'));
check('safeway double-column items found', r3.items.length >= 2, r3.items.length);

// Synthetic totals
check('grand total beats subtotal', C.parseReceipt('MART\nSUBTOTAL 90.00\nTAX 7.20\nGRAND TOTAL 97.20').total === 97.20);
check('credit -A ignored', C.parseReceipt('STORE\nCOUPON 5.00-A\nTOTAL DUE 41.25').total === 41.25);

// Classification sanity
const meal = C.parseReceipt('The Rusty Grill\n123 Main St\nBURGER 12.99\nGRATUITY 3.00\nTOTAL 25.77');
check('meal categorized', meal.category === 'Meals & Entertainment', meal.category);

// Exporters (mobile copy)
const X = require('../src/lib/exporters.js');
const rows = [
  { date: '2026-07-01', merchant: 'Home Depot', amount: 74.45, category: 'Supplies & Materials', sc: 'Line 22 — Supplies', notes: '', rid: 'R1', split: '', business: true, taxPortion: 3.5 },
  { date: '2026-07-02', merchant: 'Ad Co', amount: 50.0, category: 'Advertising & Marketing', sc: 'Line 8 — Advertising', notes: '', rid: 'R2', split: '', business: true, taxPortion: null },
];
const csv = X.buildCpaCSV(rows);
check('CSV BOM + header', csv.charCodeAt(0) === 0xFEFF && csv.includes('Date,Merchant,Amount,Tax Form'));
const txf = X.buildTXF(rows, new Date(2026, 7, 1));
check('TXF codes present', txf.content.includes('N304') && txf.content.includes('N301'));

// Amounts over $999 printed WITHOUT a thousands separator. MONEY began with
// [0-9]{1,3}, so it matched only the last three digits before the decimal:
// "1124.06" was read as 124.06 and "12345.67" as 345.67. Found by the synthetic
// corpus; on a tax record this silently understates a large purchase by an
// order of magnitude.
const big = C.parseReceipt(
  'HOME DEPOT\nLUMBER  1124.06\nSubtotal  1124.06\nTAX  81.49\nTOTAL  1205.55');
check('four figures, no separator: total', big.total === 1205.55, big.total);
check('four figures, no separator: subtotal', big.subtotal === 1124.06, big.subtotal);

const huge = C.parseReceipt('TRACTOR SUPPLY\nEQUIPMENT  12345.67\nTOTAL  12345.67');
check('five figures, no separator', huge.total === 12345.67, huge.total);

const grouped = C.parseReceipt('HOME DEPOT\nLUMBER  1,124.06\nTOTAL SALE  1,205.55');
check('thousands separator still parses', grouped.total === 1205.55, grouped.total);

const twoSeps = C.parseReceipt('EQUIPMENT CO\nEXCAVATOR  123,456.78\nTOTAL  123,456.78');
check('two separators still parse', twoSeps.total === 123456.78, twoSeps.total);

// Above $1,000,000 extractTotal declines on purpose — a receipt scanner for a
// sole proprietor seeing seven figures is far more likely to be reading OCR
// garbage than a real purchase. Asserted so the guard is deliberate, not lore.
const absurd = C.parseReceipt('AUCTION\nLOT 1  1,234,567.89\nTOTAL  1,234,567.89');
check('seven figures rejected as implausible', absurd.total === null, absurd.total);

// Must not start matching partway through a longer digit run, and must still
// ignore three-decimal unit prices.
const unitPrice = C.parseReceipt(
  'SAFEWAY\n2113016285 BLACK PEPPER   4.88 4.968\nTOTAL  4.88');
check('three-decimal unit price still ignored', unitPrice.total === 4.88, unitPrice.total);

// A printed tax rate on the SAME line as its amount. Found by the synthetic
// corpus (scripts/synth-corpus.js) on its first run: MONEY matched "8.25" out
// of "8.25%" and the RATE was returned as the tax. US receipts print this way
// constantly, so it was wrong on a large share of real input.
const rateSameLine = C.parseReceipt(
  'HOME DEPOT\n2X4 LUMBER  100.00\nSUBTOTAL  100.00\nTAX 8.25%   8.25\nTOTAL  108.25');
check('printed rate on the tax line is not the tax', rateSameLine.taxTotal === 8.25, rateSameLine.taxTotal);

const rateDiffers = C.parseReceipt(
  'OFFICE DEPOT\nCOPY PAPER  123.80\nSUB-TOTAL  123.80\nGET 8.00%   9.90\nAMOUNT DUE  133.70');
check('rate and tax differ: tax wins, not the rate', rateDiffers.taxTotal === 9.90, rateDiffers.taxTotal);
check('rate and tax differ: rate still read', Math.abs(rateDiffers.taxRatePrinted - 0.08) < 1e-9, rateDiffers.taxRatePrinted);
check('rate and tax differ: total unaffected', rateDiffers.total === 133.70, rateDiffers.total);

// The Bass Pro shape must keep working: there the money comes FIRST and the
// percent belongs to an "@" clause, so the amount is the taxable base and the
// tax is computed from it. The fix above must not touch this path.
const atRate = C.parseReceipt(
  'BASS PRO SHOPS\nLURE  13.98\nTAX  $13.98 @ 6.0%\nTOTAL  14.82');
check('taxable-base "@ rate%" still computes tax', Math.abs(atRate.taxTotal - 0.84) < 0.01, atRate.taxTotal);

// A tip is part of what the meal cost, so it counts toward the deductible
// total (D-042). Card slips print the pre-tip figure first and the real amount
// lower down, so the parser used to take the smaller one.
const tipped = C.parseReceipt(
  'THE RUSTY GRILL\nBURGER  240.00\nSTATE TAX  48.71\nAMOUNT CHARGED  288.71\nTIP  41.64\nAMOUNT PAID  330.35');
check('tip counts toward the total', tipped.total === 330.35, tipped.total);

// The dangerous direction is the opposite one: inflating a deduction. Adding a
// tip to a total that already includes it must not happen, so the post-tip
// figure has to be printed before it is trusted.
const alreadyIncluded = C.parseReceipt(
  'THE RUSTY GRILL\nBURGER  20.00\nTIP  4.00\nTOTAL  24.00');
check('tip not double-counted when total already includes it',
  alreadyIncluded.total === 24.00, alreadyIncluded.total);

// Handwritten tip: nothing printed to add, so the printed total stands.
const handwritten = C.parseReceipt(
  'THE RUSTY GRILL\nBURGER  20.00\nTAX  1.65\nTOTAL  21.65\nTIP  ________\nTOTAL  ________');
check('handwritten tip leaves the total alone', handwritten.total === 21.65, handwritten.total);

// A suggested-tip guide is advice, not a charge — and it prints plausible
// post-tip totals, which is exactly what would fool a careless rule.
const guide = C.parseReceipt(
  'THE RUSTY GRILL\nBURGER  20.00\nTOTAL  20.00\nSUGGESTED TIP\n15% = 3.00\n18% = 3.60\n20% = 4.00');
check('suggested-tip guide is not a charge', guide.total === 20.00, guide.total);

// GRATUITY is the same thing under another name.
const grat = C.parseReceipt(
  'CAFE\nLUNCH  50.00\nTOTAL  50.00\nGRATUITY  9.00\nTOTAL PAID  59.00');
check('gratuity counts too', grat.total === 59.00, grat.total);

// Restore-from-archive planning (pure half of exportShare.restoreArchive)
const RP = require('../src/lib/restorePlan.js');
const NOW = '2026-08-22T00:00:00.000Z';
const arch = [
  { merchant: 'Costco', date: '2026-07-01', total: 140.35, imageFile: 'a.jpg' },
  { merchant: 'Safeway', date: '2026-07-02', total: 22.10 },
];

// Fresh device: everything comes in.
const first = RP.planRestore(arch, new Set(), NOW);
check('restore: empty device imports all', first.toImport.length === 2 && first.skipped === 0);

// Same archive again, now that those receipts exist — the no-op the UI promises.
const onDevice = new Set(first.toImport.map(RP.fingerprint));
const second = RP.planRestore(arch, onDevice, NOW);
check('restore: re-importing the same archive is a no-op',
  second.toImport.length === 0 && second.skipped === 2);

// Partial overlap: only the missing one is added.
const partial = RP.planRestore(arch, new Set([RP.fingerprint(arch[0])]), NOW);
check('restore: only missing receipts are added',
  partial.toImport.length === 1 && partial.toImport[0].merchant === 'Safeway' && partial.skipped === 1);

// Fingerprint ignores id, case and cent formatting; a different total is a different receipt.
check('restore: fingerprint ignores id/case/whitespace',
  RP.fingerprint({ id: 7, merchant: '  COSTCO  ', date: '2026-07-01T12:00:00Z', total: 140.3 })
    === RP.fingerprint({ id: 91, merchant: 'costco', date: '2026-07-01', total: 140.30 }));
check('restore: a different total is a different receipt',
  RP.fingerprint({ merchant: 'Costco', date: '2026-07-01', total: 140.35 })
    !== RP.fingerprint({ merchant: 'Costco', date: '2026-07-01', total: 140.36 }));

// A duplicate inside one archive collapses, so a malformed export cannot double-insert.
const dupes = RP.planRestore([arch[0], { ...arch[0], id: 99 }], new Set(), NOW);
check('restore: duplicates within one archive collapse',
  dupes.toImport.length === 1 && dupes.skipped === 1);

// An older/sparser archive must still yield an importable row.
const sparse = RP.planRestore([{ merchant: 'Corner Store' }], new Set(), NOW);
const row = sparse.toImport[0];
check('restore: a sparse row is filled in, not dropped',
  sparse.toImport.length === 1 && row.total === 0 && row.date === '' &&
  Array.isArray(row.allocations) && row.salesTax === null && row.createdAt === NOW);
check('restore: non-array payload yields nothing', RP.planRestore(null, new Set(), NOW).toImport.length === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
