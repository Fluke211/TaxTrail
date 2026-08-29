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
check('meal categorized', meal.category === 'Business Meals', meal.category);

// Exporters (mobile copy)
const X = require('../src/lib/exporters.js');
const rows = [
  { date: '2026-07-01', merchant: 'Home Depot', amount: 74.45, category: 'Supplies & Materials', sc: 'Line 22 — Supplies', notes: '', rid: 'R1', split: '', business: true, taxPortion: 3.5 },
  { date: '2026-07-02', merchant: 'Ad Co', amount: 50.0, category: 'Advertising & Marketing', sc: 'Line 8 — Advertising', notes: '', rid: 'R2', split: '', business: true, taxPortion: null },
];
const csv = X.buildCpaCSV(rows);
check('CSV BOM + header', csv.charCodeAt(0) === 0xFEFF && csv.includes('Date,Merchant,Amount,Tax Form'));

// The BOM belongs on the CPA CSV, which a human opens in Excel, and NOT on the
// QuickBooks file, which is machine-read by QBO's importer — there a leading
// BOM can only be read as part of the first header name, and the mapping step
// then fails to match the "Date" column.
const qbo = X.buildQBO(rows);
check('QuickBooks CSV carries no BOM', qbo.charCodeAt(0) !== 0xFEFF);
check('QuickBooks CSV header is matchable', qbo.indexOf('Date,Description,Amount') === 0);
// Money out is negative, per Intuit's sample table ("Example of a payment /
// -100.00" against "Example of a deposit / 200.00").
check('QuickBooks amounts are negative for money out', qbo.includes(',-74.45'));
check('QuickBooks dates are MM/DD/YYYY', qbo.includes('07/01/2026'));
const txf = X.buildTXF(rows, new Date(2026, 7, 1));
check('TXF codes present', txf.content.includes('N304') && txf.content.includes('N301'));

// ---------------------------------------------------------------------------
// TXF v042 — byte-exact, because every field in this file is load-bearing and
// an importer that mis-reads one does not complain, it just files a wrong
// number. Checked field by field against the v042 spec (see D-046):
//
//   header      "The fields for the Header of the file are: V version /
//               A accounting program name/version / D export date"
//   date        v035 changelog: "Changed date format to mm/dd/yyyy" — so the
//               month and day are ZERO-PADDED. This used to emit "D8/1/2026".
//   order       "This is the recommended order: T type / N refnum / C copy /
//               L line / X detail" with "$ amount" before any X
//   sign        "Expenses, losses, and money spent ... are negative numbers"
//   format 1    T, N, C, L, $ — and nothing else. No X on a summary record.
//   line ends   CRLF, and a trailing CRLF after the final "^"
const TXF_EXPECT = [
  'V042', 'ATaxTrail 1.0.0 r16', 'D08/01/2026', '^',
  'TS', 'N301', 'C1', 'L1', '$-74.45', '^',
  'TS', 'N304', 'C1', 'L1', '$-50.00', '^',
].join('\r\n') + '\r\n';
const txfExact = X.buildTXF(rows, new Date(2026, 7, 1), '1.0.0 r16');
check('TXF is byte-exact', txfExact.content === TXF_EXPECT,
  JSON.stringify(txfExact.content));

// Refnum 302 is Record Format 3 ("$ amount / P description"), per the Frm
// column of the refnum table and the changelog line "RNum 302 changed to
// Record Format 3". Schedule C line 27 is itemized in Part V, so each category
// needs its OWN record with its own P and its own L — the spec's format-3
// example does exactly this, with N287 on L1 and again on L2.
//
// The old output merged every "other" category into ONE record and listed the
// names in an X line, which is not a field that belongs on a summary record at
// all. The itemization was lost.
const otherRows = [
  { date: '2026-07-01', merchant: 'Adobe', amount: 59.99, category: 'Software & Subscriptions', sc: '', notes: '', rid: 'R1', split: '', business: true, taxPortion: null },
  { date: '2026-07-02', merchant: 'Bank', amount: 12.00, category: 'Bank & Merchant Fees', sc: '', notes: '', rid: 'R2', split: '', business: true, taxPortion: null },
  { date: '2026-07-03', merchant: 'Adobe', amount: 40.01, category: 'Software & Subscriptions', sc: '', notes: '', rid: 'R3', split: '', business: true, taxPortion: null },
];
const other = X.buildTXF(otherRows, new Date(2026, 7, 1), '1.0.0 r16');
const OTHER_EXPECT = [
  'V042', 'ATaxTrail 1.0.0 r16', 'D08/01/2026', '^',
  'TS', 'N302', 'C1', 'L1', '$-12.00', 'PBank & Merchant Fees', '^',
  'TS', 'N302', 'C1', 'L2', '$-100.00', 'PSoftware & Subscriptions', '^',
].join('\r\n') + '\r\n';
check('TXF format 3: one record per category, P line, incrementing L',
  other.content === OTHER_EXPECT, JSON.stringify(other.content));
check('TXF: no X line on a summary record', other.content.indexOf('\r\nX') === -1);

// A category total CAN go negative, and the export used to emit a malformed
// record when it did. CaptureScreen stored the split remainder as
// total - sum(allocations) with nothing capping the splits, so a $50 receipt
// split into two $30 parts saved a -$10 allocation; the amount was then built
// by concatenating "$-" onto "-10.00", giving "$--10.00". An importer has no
// way to read that. (The UI now caps a split at what is left, but restored
// archives can carry anything, so the exporter must not depend on that.)
const negRows = [
  { date: '2026-07-01', merchant: 'Home Depot', amount: -10.00, category: 'Supplies & Materials', sc: '', notes: '', rid: 'R1', split: '1 of 3', business: true, taxPortion: null },
  { date: '2026-07-01', merchant: 'Home Depot', amount: 30.00, category: 'Advertising & Marketing', sc: '', notes: '', rid: 'R1', split: '2 of 3', business: true, taxPortion: null },
];
const neg = X.buildTXF(negRows, new Date(2026, 7, 1), 'v');
check('TXF: a negative category total never emits "$--"', neg.content.indexOf('$--') === -1, neg.content);
// Sgn=E means the normal sign is "-", so negating is not just well-formed, it
// is right: a category that nets to a credit belongs on the expense line as a
// positive number. Same thing GnuCash does via gnc-numeric-neg.
check('TXF: a credit reads as a positive amount on the expense line',
  neg.content.includes('$10.00') && neg.content.includes('$-30.00'), neg.content);
check('TXF: zero never prints as "-0.00"',
  X.buildTXF([{ date: '2026-07-01', merchant: 'M', amount: 0, category: 'Supplies & Materials', sc: '', notes: '', rid: 'R1', split: '', business: true, taxPortion: null }],
    new Date(2026, 7, 1), 'v').content.includes('$0.00'));

// Postage is Schedule C line 18 ("Include on this line your expenses for
// office supplies and postage"), which is refnum 313 — not the 302 catch-all.
// Employee benefits is line 14, refnum 308, which is what the app's own
// category label already claimed; 302 made the file contradict the UI.
const mapRows = [
  { date: '2026-07-01', merchant: 'USPS', amount: 20.00, category: 'Shipping & Postage', sc: '', notes: '', rid: 'R1', split: '', business: true, taxPortion: null },
  { date: '2026-07-02', merchant: 'Gusto', amount: 30.00, category: 'Employee Benefits', sc: '', notes: '', rid: 'R2', split: '', business: true, taxPortion: null },
];
const mapped = X.buildTXF(mapRows, new Date(2026, 7, 1), 'v');
check('postage maps to 313 (line 18), not the 302 catch-all',
  mapped.content.includes('N313') && !mapped.content.includes('N302'));
check('employee benefits maps to 308 (line 14)', mapped.content.includes('N308'));
check('app label and TXF code agree on employee benefits',
  /Line 14/.test(C.CATEGORIES.filter(function (c) { return c.name === 'Employee Benefits'; })[0].scheduleC));

// The IRS swapped these two sub-lines for tax year 2025: 27a became the
// energy-efficient-buildings deduction (Form 7205) and "Other expenses (from
// line 48)" moved to 27b. The 2026 draft keeps the 2025 ordering, so this is
// not a one-year blip. Every affected label is display-only, but a CPA reading
// "Line 27a" against a current return is being told the wrong box.
check('no category still claims line 27a',
  C.CATEGORIES.every(function (c) { return !/27a/.test(c.scheduleC || ''); }));
check('other-expense categories say 27b',
  /Line 27b/.test(C.CATEGORIES.filter(function (c) { return c.name === 'Software & Subscriptions'; })[0].scheduleC));
check('postage label moved to line 18',
  /Line 18/.test(C.CATEGORIES.filter(function (c) { return c.name === 'Shipping & Postage'; })[0].scheduleC));

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

// ---- Gating decisions (src/lib/gates.js) ----
// These were inline in CaptureScreen, where the only way to exercise "what
// happens on the 11th scan" was to scan eleven receipts on a phone.
const G = require('../src/lib/gates.js');

// The free-tier boundary. Off by one in either direction is a real cost: one
// way gives away a scan, the other blocks a user who was promised ten.
check('free tier: 9 used, not gated', G.isOverFreeLimit({ scansThisMonth: 9, limit: 10 }) === false);
check('free tier: 10 used, gated (the 11th scan)', G.isOverFreeLimit({ scansThisMonth: 10, limit: 10 }) === true);
check('free tier: 11 used, still gated', G.isOverFreeLimit({ scansThisMonth: 11, limit: 10 }) === true);
check('free tier: 0 used, not gated', G.isOverFreeLimit({ scansThisMonth: 0, limit: 10 }) === false);
check('free tier: pro is never gated', G.isOverFreeLimit({ isPro: true, scansThisMonth: 9999, limit: 10 }) === false);
// A missing or broken count must not lock a paying-nothing user out of the app.
check('free tier: undefined count treated as 0', G.isOverFreeLimit({ limit: 10 }) === false);
check('free tier: NaN count treated as 0', G.isOverFreeLimit({ scansThisMonth: NaN, limit: 10 }) === false);

// The review prompt. iOS allows three dialogs a YEAR, so spending one on the
// wrong moment is not recoverable for months.
check('review: not before the 3rd scan', G.shouldAskForReview({ lifetimeScans: 2, askAfter: 3 }) === false);
check('review: on the 3rd scan', G.shouldAskForReview({ lifetimeScans: 3, askAfter: 3 }) === true);
// The old code used `=== 3`, so saving two receipts before the check ran skipped
// the prompt forever. >= cannot be skipped.
check('review: still asks if the count jumped past 3',
  G.shouldAskForReview({ lifetimeScans: 7, askAfter: 3 }) === true);
// ...and once asked, never again. The old monthly count re-fired every month.
check('review: never asked twice',
  G.shouldAskForReview({ lifetimeScans: 500, alreadyAsked: true, askAfter: 3 }) === false);
check('review: garbage count does not trigger',
  G.shouldAskForReview({ lifetimeScans: NaN, askAfter: 3 }) === false);

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

// ---------------------------------------------------------------------------
// The decimal point Vision turns into a space.
//
// Every string below is verbatim from __tests__/corpus/costco-1.txt. Before the
// MONEY_SPACED fallback, none of these lines yielded an amount at all — the
// synthetic corpus recovered the total on 12.6% of receipts carrying this
// artifact. Fixtures, not paraphrases, because the whole point is that the real
// scanner produces exactly this.
check('spaced decimal: total on its own line',
  C.parseReceipt('COSTCO WHOLESALE\nwx TOTAL\n140. 35').total === 140.35);
check('spaced decimal: labelled amount',
  C.parseReceipt('COSTCO WHOLESALE\nAMOUNT: $140. 35').total === 140.35);
check('spaced decimal: item price',
  C.parseReceipt('COSTCO\nE 1955255 POWER VEG      1. 49 A\nTOTAL      1. 49').total === 1.49);
check('spaced decimal: thousands separator survives it',
  C.parseReceipt('LOWES\nTOTAL      1,234. 56').total === 1234.56);
check('spaced decimal: tax line too',
  C.parseReceipt('SAFEWAY\nSUBTOTAL   10. 00\nSALES TAX   0. 47\nTOTAL   10. 47').taxTotal === 0.47);

// A smudge fused onto the label — "wx TOTAL" in costco-1.txt. This already
// worked; pinned so a future tightening of TOTAL_HINTS cannot quietly undo it.
check('glyph-prefixed label still reads as a total',
  C.parseReceipt('HOME DEPOT\nwx TOTAL      52.10').total === 52.10);

// The guard on the loose pass. A comma before a space is ordinary prose, and
// reading it as money would invent an amount out of an address line, so the
// spaced form accepts a period and the OCR bracket glyphs only.
check('comma-space is not an amount',
  C.parseReceipt('CORNER STORE\nSuite 200, 50 Main St\nTOTAL 7.25').total === 7.25);
check('comma-space alone yields no total',
  C.parseReceipt('CORNER STORE\nSuite 200, 50 Main St').total === null);

// The loose pass runs ONLY when the strict pass came up empty, so a line that
// already parses cannot change meaning. Here "12.99" must win over any reading
// of "3. 50" on the same line.
check('strict match wins; loose never overrides it',
  C.parseReceipt('STAPLES\nTOTAL 12.99 qty 3. 50').total === 12.99);

// A printed rate is still not an amount, on either pass.
check('spaced rate is not mistaken for tax',
  C.parseReceipt('SAFEWAY\nSUBTOTAL 100. 00\nTAX 8. 25%   8. 25\nTOTAL 108. 25').total === 108.25);

// ---------------------------------------------------------------------------
// Splitting sales tax across a split receipt.
//
// The old code rounded each part on its own, which both LOST and INVENTED
// cents. Sales tax flows to Schedule A line 5a, so an over-reported figure is
// an over-claim on a filed return — the invented cent is the worse of the two.
const PR = require('../src/lib/prorate.js');
const sum = (a) => Math.round(a.reduce((s, v) => s + (v || 0), 0) * 100) / 100;

// The three cases that drifted, verbatim. Each previously summed to the wrong
// number; each must now sum to exactly the tax paid.
check('tax split: $1.00 three ways sums to $1.00',
  sum(PR.splitSalesTax(1.00, [1000, 1000, 1000], 3000)) === 1.00);
check('tax split: $0.01 two ways does not become $0.02',
  sum(PR.splitSalesTax(0.01, [5000, 5000], 10000)) === 0.01);
check('tax split: $5.00 seven ways sums to $5.00',
  sum(PR.splitSalesTax(5.00, [1000, 1000, 1000, 1000, 1000, 1000, 1000], 7000)) === 5.00);

// The odd cent goes to exactly one part, not to all of them and not to none.
const three = PR.splitSalesTax(1.00, [1000, 1000, 1000], 3000);
check('tax split: the odd cent lands on one part only',
  JSON.stringify(three) === JSON.stringify([0.34, 0.33, 0.33]), JSON.stringify(three));
check('tax split: $0.01 goes to one part and zero to the other',
  JSON.stringify(PR.splitSalesTax(0.01, [5000, 5000], 10000)) === JSON.stringify([0.01, 0]));

// Unsplit receipts — the overwhelming majority — must be untouched by all this.
check('tax split: a single allocation gets the whole tax',
  JSON.stringify(PR.splitSalesTax(8.25, [10000], 10000)) === JSON.stringify([8.25]));

// Proportional, not merely equal: a 90/10 split gets a 90/10 share of the tax.
check('tax split: follows the allocation weights',
  JSON.stringify(PR.splitSalesTax(10.00, [9000, 1000], 10000)) === JSON.stringify([9, 1]));

// No sales tax recorded means no column value, not a zero — a CPA reading
// "0.00" would conclude the receipt had no tax, which is a different claim
// from "we do not know".
check('tax split: absent tax yields nulls, not zeros',
  JSON.stringify(PR.splitSalesTax(null, [100, 100], 200)) === JSON.stringify([null, null]));
check('tax split: zero tax yields nulls', PR.splitSalesTax(0, [100], 100)[0] === null);

// Allocations covering only part of the receipt carry only that part of the
// tax, rather than silently absorbing all of it.
check('tax split: partial allocations carry a partial share',
  sum(PR.splitSalesTax(10.00, [5000], 10000)) === 5.00);

// Degenerate input must not produce NaN in a tax export.
check('tax split: zero weights do not divide by zero',
  JSON.stringify(PR.splitSalesTax(5.00, [0, 0], 0)) === JSON.stringify([0, 0]));
check('prorate: no weights, no parts', JSON.stringify(PR.prorateCents(100, [])) === JSON.stringify([]));
check('prorate: parts always sum to the whole, over many shapes', (function () {
  for (let total = 1; total <= 40; total++) {
    for (let n = 1; n <= 7; n++) {
      const w = []; for (let i = 0; i < n; i++) w.push(1 + ((total * 7 + i * 13) % 11));
      const parts = PR.prorateCents(total, w);
      if (parts.reduce((s, v) => s + v, 0) !== total) return false;
      if (parts.some((v) => v < 0)) return false;
    }
  }
  return true;
})());
// ---------------------------------------------------------------------------
// Renaming a category is a data migration (D-050).
//
// "Meals & Entertainment" became "Business Meals" because entertainment has
// been nondeductible since the TCJA and the Schedule C instructions say twice
// "Do not include entertainment expenses on this line" — the old name invited
// filing an entertainment receipt into a 50%-deductible bucket.
//
// The name is a string on every saved receipt AND inside every allocation AND
// inside every exported archive, so the old name keeps arriving forever.
check('rename: the old name maps to the new one',
  C.canonicalCategory('Meals & Entertainment') === 'Business Meals');
check('rename: an unrelated category passes through untouched',
  C.canonicalCategory('Insurance') === 'Insurance');
check('rename: surrounding whitespace still resolves',
  C.canonicalCategory('  Meals & Entertainment  ') === 'Business Meals');
check('rename: null and undefined do not throw',
  C.canonicalCategory(null) === null && C.canonicalCategory(undefined) === undefined);
check('rename: the old name is gone from the category list',
  C.CATEGORIES.every(function (c) { return c.name !== 'Meals & Entertainment'; }));
check('rename: the new category kept the TXF code', C.TXF_CODES['Business Meals'] === 294);
check('rename: the old name has no TXF code', C.TXF_CODES['Meals & Entertainment'] === undefined);
check('rename: a restaurant receipt lands in Business Meals',
  C.parseReceipt('THE RUSTY GRILL\nSERVER: MAY\nTOTAL 42.00').category === 'Business Meals');

// The label now matches the form. The 2025 instructions head this line
// "Deductible meals" and state "In most cases, the percentage is 50%".
check('rename: the label matches the 2025 form wording',
  C.CATEGORIES.filter(function (c) { return c.name === 'Business Meals'; })[0].scheduleC
    === 'Line 24b — Deductible meals (50%)');

// The migration rewrites allocations with a plain string replace on the QUOTED
// JSON form. This asserts the assumption that makes that safe: only the
// category value changes, the result is still valid JSON, and a Schedule C
// label or note mentioning the same words is untouched.
const allocBefore = JSON.stringify([
  { category: 'Meals & Entertainment', scheduleC: 'Line 24b — Meals (50% deductible)', amount: 12.34 },
  { category: 'Insurance', scheduleC: 'Line 15 — Insurance', amount: 5 },
]);
const allocAfter = allocBefore.split(JSON.stringify('Meals & Entertainment'))
  .join(JSON.stringify('Business Meals'));
const reparsed = JSON.parse(allocAfter);
check('migration: allocation category is rewritten', reparsed[0].category === 'Business Meals');
check('migration: the amount is untouched', reparsed[0].amount === 12.34);
check('migration: a label mentioning the same words is untouched',
  reparsed[0].scheduleC === 'Line 24b — Meals (50% deductible)');
check('migration: other allocations are untouched',
  reparsed[1].category === 'Insurance' && reparsed[1].amount === 5);

// Restore must map on the way in, or an old archive resurrects a category that
// no longer exists — and would export with no TXF code at all.
const oldArchive = RP.planRestore([{
  merchant: 'The Rusty Grill', date: '2026-07-01', total: 42,
  category: 'Meals & Entertainment',
  allocations: [{ category: 'Meals & Entertainment', scheduleC: '', amount: 42 }],
}], new Set(), NOW);
check('restore: an old archive imports under the new name',
  oldArchive.toImport[0].category === 'Business Meals');
check('restore: allocations inside an old archive are mapped too',
  oldArchive.toImport[0].allocations[0].category === 'Business Meals');

// ---------------------------------------------------------------------------
// Schedule C line 20a — the one uncovered line that is actually receipt-shaped.
//
// The 2025 instructions split line 20 cleanly: "If you rented or leased
// vehicles, machinery, or equipment, enter on line 20a" vs "Enter on line 20b
// amounts paid to rent or lease other property, such as office space in a
// building." Renting a lift produces a receipt; a mortgage interest statement
// and a pension plan filing do not, which is why those lines stay uncovered.
check('20a: the category exists and names the right line',
  C.CATEGORIES.filter(function (c) { return c.name === 'Equipment Rental'; })[0].scheduleC
    === 'Line 20a — Rent/lease: vehicles, machinery, equipment');
check('20a: refnum 299 ("Rent on vehicles, mach, eq")', C.TXF_CODES['Equipment Rental'] === 299);
check('20a: an equipment rental receipt lands there',
  C.parseReceipt('SUNBELT RENTALS\nSCISSOR LIFT\nTOTAL 240.00').category === 'Equipment Rental',
  C.parseReceipt('SUNBELT RENTALS\nSCISSOR LIFT\nTOTAL 240.00').category);
// 20b is space, and must not be pulled into 20a by the new keywords.
check('20b: office space rent still lands in Rent & Lease',
  C.parseReceipt('REGUS\nOFFICE RENT\nMONTHLY RENT\nTOTAL 800.00').category === 'Rent & Lease',
  C.parseReceipt('REGUS\nOFFICE RENT\nMONTHLY RENT\nTOTAL 800.00').category);
// A car rented on a business trip is travel (24a), not 20a. Left deliberately.
check('24a: a rental car on a trip still lands in Travel',
  C.parseReceipt('HERTZ\nRENTAL CAR\nTOTAL 310.00').category === 'Travel & Lodging',
  C.parseReceipt('HERTZ\nRENTAL CAR\nTOTAL 310.00').category);

// ---------------------------------------------------------------------------
// Three bugs from Tyler's first real diagnostics export (6 receipts, r19).
// Full receipts live in __tests__/corpus/; these pin the specific behaviours.

// 1. STACKED COLUMNS — the total was read as the subtotal.
//
// A real Target receipt prints every label, then every value, so the amounts
// line up by position rather than adjacency. "amount on this line or the next"
// handed TOTAL the subtotal and the receipt exported $1.50 light — silently,
// because $25.00 is a real number printed on the receipt.
const column = C.parseReceipt(
  'Glen Allen Broad St\nFURNITURE\n074110260 Room Esntls\nT\n$25.00\n' +
  'SUBTOTAL\nT = VA TAX 6.00000 on $25.00\nTOTAL\n$25.00\n$1.50\n$26.50\n' +
  '*2697 VISA CHARGE\n$26.50');
check('stacked columns: total is the total, not the subtotal', column.total === 26.50, column.total);
check('stacked columns: tax still reads correctly', column.taxTotal === 1.50, column.taxTotal);

// The repair must NOT fire on a tax-inclusive receipt where the total really
// does equal the subtotal. The guard is that subtotal + tax has to appear
// verbatim somewhere; here it does not, so the total stands.
const inclusive = C.parseReceipt(
  'CORNER STORE\nSUBTOTAL   10.00\nTAX INCLUDED   0.60\nTOTAL   10.00');
check('tax-inclusive receipt is left alone', inclusive.total === 10.00, inclusive.total);

// 2. PROMOTIONAL FOOTER — a coupon must not decide the category.
//
// A real Bass Pro receipt for fishing bait ends with a coupon for the
// Islamorada Fish Company RESTAURANT. That single word filed a bait purchase
// as a 50%-deductible business meal.
const promo = C.parseReceipt(
  'Bass Pro Shops\nYellow Replacement Ba\n$6.99\nTOTAL\n$14.82\n' +
  'Keep In Touch!\nFacebook.com/BassProShops\n' +
  'Bring your Bass Pro Shops receipt to our Islamorada Fish Company\n' +
  'Restaurant and receive $5 off your food purchase of $20.');
check('promo footer does not create a business meal', promo.category !== 'Business Meals', promo.category);

// A tail hit is not thrown away — it just cannot win alone. With a real body
// signal present, the category is still decided by the body.
const bodyWins = C.parseReceipt(
  'HOME DEPOT\nLUMBER  20.00\nTOTAL  20.00\nKeep In Touch!\nVisit our Restaurant');
check('body signal still wins over a tail hit',
  bodyWins.category === 'Supplies & Materials', bodyWins.category);

// The marker is only searched in the BACK HALF, because these phrases appear
// legitimately near the top: a real Cabelas receipt has "NOW HIRING" on line 3,
// and cutting there would discard the entire purchase.
const earlyMarker = C.parseReceipt(
  'NOW HIRING\nAPPLY ONLINE\nHOME DEPOT\nLUMBER 30.00\nDRYWALL 10.00\nTOTAL 40.00');
check('an early promo phrase does not truncate the receipt',
  earlyMarker.total === 40.00 && earlyMarker.category === 'Supplies & Materials',
  earlyMarker.category + '/' + earlyMarker.total);

// 3. SLOGAN — some receipts never print the store's name.
//
// A real Home Depot receipt opens "How doers get more done." across two lines.
// The merchant parsed as "How doers" and nothing matched, so a hardware
// purchase landed Uncategorized.
const slogan = C.parseReceipt(
  'How doers\nget more done.\n421 ALAKAWA STREET, HONOLULU,\n, HI 96817\n' +
  'SUBTOTAL\n71.90\nSALES TAX\n3.39\nTOTAL\n$75.29');
check('slogan names the merchant', slogan.merchant === 'Home Depot', slogan.merchant);
check('slogan reaches the right category',
  slogan.category === 'Supplies & Materials', slogan.category);
// Matching is whitespace-flattened because OCR wraps the slogan mid-phrase.
check('slogan matches across a line break',
  C.parseReceipt('How doers\nget more done.\nTOTAL 5.00').merchant === 'Home Depot');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
