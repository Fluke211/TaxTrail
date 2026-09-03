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

// ---------------------------------------------------------------------------
// Money fields have to let you finish typing.
//
// The receipt edit fields were controlled inputs bound to a NUMBER, so every
// keystroke went text -> number -> text and anything not yet a finished number
// was erased on the way back. The decimal point could never be entered AT ALL:
// "1." parsed to 1 and rendered as "1". Every edit was silently integer-only.
// Tyler hit it correcting a sales tax to $0.40.
const MI = require('../src/lib/moneyInput.js');
const keystrokes = (s) => MI.sanitizeMoneyText(s);

// The exact sequence that failed. Each of these is a legal STATE on the way to
// a number, and a field that erases them is unusable.
check('money: a lone zero survives', keystrokes('0') === '0');
check('money: a lone dot survives', keystrokes('.') === '.');
check('money: "0." survives', keystrokes('0.') === '0.');
check('money: "0.4" survives', keystrokes('0.4') === '0.4');
check('money: "0.40" is reached', keystrokes('0.40') === '0.40');
check('money: a trailing dot is not eaten', keystrokes('1.') === '1.');

// ...and the values those states represent. "" and "." are not yet numbers,
// and null means "no value", not "zero" — a receipt with no recorded tax is a
// different claim from one with zero tax.
check('money: an unfinished entry has no value',
  MI.moneyValue('') === null && MI.moneyValue('.') === null);
check('money: "0." has no value yet', MI.moneyValue('0.') === null || MI.moneyValue('0.') === 0);
check('money: "0.40" is forty cents', MI.moneyValue('0.40') === 0.4);
check('money: ".4" is forty cents', MI.moneyValue('.4') === 0.4);
check('money: a real amount parses', MI.moneyValue('26.50') === 26.5);

// Cleaning, without destroying an in-progress entry.
check('money: letters are dropped', keystrokes('12a.3b4') === '12.34');
check('money: a comma becomes a decimal point', keystrokes('1,50') === '1.50');
check('money: only the first separator survives', keystrokes('1.2.3') === '1.23');
check('money: cents are capped at two places', keystrokes('1.2345') === '1.23');
check('money: leading zeros collapse but 0. is kept',
  keystrokes('007') === '7' && keystrokes('0.5') === '0.5');
check('money: empty stays empty', keystrokes('') === '');
check('money: null and undefined do not throw',
  keystrokes(null) === '' && keystrokes(undefined) === '');
// Truncating rather than rounding matters mid-keystroke: rounding would change
// digits the user already typed while they are still typing more.
check('money: cents truncate, never round', keystrokes('1.999') === '1.99');

// ---------------------------------------------------------------------------
// Export ranges and filenames (exportRange.js)
//
// Every export used to be labelled with the current year and contain ALL
// receipts, so `taxtrail-2026.csv` could hold three years of data and last
// year's return could not be exported at all.
// ---------------------------------------------------------------------------
const ER = require('../src/lib/exportRange.js');

const RANGE_NOW = new Date(2026, 7, 30);            // 30 Aug 2026, local time
const RCPTS = [
  { id: 1, date: '2026-08-15', total: 10 },
  { id: 2, date: '2026-01-01', total: 20 },   // the timezone trap, see below
  { id: 3, date: '2025-12-31', total: 30 },
  { id: 4, date: '2025-06-01', total: 40 },
  { id: 5, date: '', total: 50 },             // undated
];
const ids = (rs) => rs.map((r) => r.id).join(',');

check('range: ytd covers Jan 1 to today of the current year',
  ids(ER.filterByRange(RCPTS, ER.makeRange('ytd', { now: RANGE_NOW })).receipts) === '1,2',
  ids(ER.filterByRange(RCPTS, ER.makeRange('ytd', { now: RANGE_NOW })).receipts));
check('range: a whole year excludes the year either side',
  ids(ER.filterByRange(RCPTS, ER.makeRange('year', { year: 2025 })).receipts) === '3,4',
  ids(ER.filterByRange(RCPTS, ER.makeRange('year', { year: 2025 })).receipts));
check('range: all keeps everything, undated included',
  ER.filterByRange(RCPTS, ER.makeRange('all')).receipts.length === 5);
check('range: custom bounds are inclusive at both ends',
  ids(ER.filterByRange(RCPTS, ER.makeRange('custom', { from: '2025-12-31', to: '2026-01-01' })).receipts) === '2,3',
  ids(ER.filterByRange(RCPTS, ER.makeRange('custom', { from: '2025-12-31', to: '2026-01-01' })).receipts));
check('range: a backwards custom range is swapped, not made empty',
  ids(ER.filterByRange(RCPTS, ER.makeRange('custom', { from: '2026-01-01', to: '2025-12-31' })).receipts) === '2,3');

// A dateless receipt is unplaceable, not "outside the range". Dropping it from
// a tax export silently is how a deduction goes missing, so it is reported.
const ytd = ER.filterByRange(RCPTS, ER.makeRange('ytd', { now: RANGE_NOW }));
check('range: an undated receipt is reported, never silently dropped',
  ytd.undated.length === 1 && ytd.undated[0].id === 5);
check('range: undated receipts are not counted as in-range',
  ytd.receipts.every((r) => r.id !== 5));

// THE TIMEZONE TRAP. `new Date('2026-01-01')` is UTC midnight, which is
// 2025-12-31 anywhere in the US — so a Date-based year filter drops New Year's
// Day receipts for every American user. Comparing ISO strings has no timezone
// to get wrong. This test is the reason exportRange.js never constructs a Date
// from a receipt's date.
check('range: Jan 1 belongs to its own year, not the previous one (TZ trap)',
  ER.inRange('2026-01-01', ER.makeRange('year', { year: 2026 })) === true &&
  ER.inRange('2026-01-01', ER.makeRange('year', { year: 2025 })) === false);
check('range: Dec 31 belongs to its own year (TZ trap, other end)',
  ER.inRange('2025-12-31', ER.makeRange('year', { year: 2025 })) === true &&
  ER.inRange('2025-12-31', ER.makeRange('year', { year: 2026 })) === false);

// Filenames say what the file holds and when it was made. Exporting twice used
// to produce the same name twice, which iOS resolves by appending "(1)".
check('filename: a whole year',
  ER.exportFileName('taxtrail', 'csv', ER.makeRange('year', { year: 2025 }), RANGE_NOW)
    === 'taxtrail-2025-exported-2026-08-30.csv',
  ER.exportFileName('taxtrail', 'csv', ER.makeRange('year', { year: 2025 }), RANGE_NOW));
check('filename: year to date',
  ER.exportFileName('taxtrail', 'txf', ER.makeRange('ytd', { now: RANGE_NOW }), RANGE_NOW)
    === 'taxtrail-2026-ytd-exported-2026-08-30.txf');
check('filename: everything',
  ER.exportFileName('taxtrail', 'xlsx', ER.makeRange('all'), RANGE_NOW)
    === 'taxtrail-all-exported-2026-08-30.xlsx');
check('filename: a custom range spells out both ends',
  ER.exportFileName('taxtrail', 'csv', ER.makeRange('custom', { from: '2026-01-01', to: '2026-06-30' }), RANGE_NOW)
    === 'taxtrail-2026-01-01-to-2026-06-30-exported-2026-08-30.csv',
  ER.exportFileName('taxtrail', 'csv', ER.makeRange('custom', { from: '2026-01-01', to: '2026-06-30' }), RANGE_NOW));

// isoDay must use the DEVICE's calendar day. toISOString() would report the UTC
// day, which is tomorrow for anyone east of Greenwich late in the evening.
check('filename: the stamp is the local calendar day, not the UTC one',
  ER.isoDay(new Date(2026, 0, 1, 23, 30)) === '2026-01-01',
  ER.isoDay(new Date(2026, 0, 1, 23, 30)));

// The picker offers years that HAVE receipts. A fixed "this year / last year"
// would show an empty January and hide a year the user has data for.
check('range: years present, newest first',
  ER.yearsPresent(RCPTS).join(',') === '2026,2025', ER.yearsPresent(RCPTS).join(','));
check('range: no receipts means no years, not a crash',
  ER.yearsPresent([]).length === 0 && ER.yearsPresent(null).length === 0);

// ---------------------------------------------------------------------------
// Did the user have to correct the parser? (edited.js)
//
// Tyler asked for `edited: true` in diagnostics. The flag is derived from a
// snapshot of the classifier's own output rather than tracked, so there is no
// bookkeeping to fall out of sync — and the snapshot turns every correction
// into a labelled fixture.
// ---------------------------------------------------------------------------
const ED = require('../src/lib/edited.js');

const SNAP = { merchant: 'Target', date: '2026-08-15', total: 25.00, salesTax: 1.5, category: 'Supplies & Materials', confidence: 'high' };
const asStored = (over) => Object.assign({ merchant: 'Target', date: '2026-08-15', total: 25.00, salesTax: 1.5, category: 'Supplies & Materials' }, over || {});

check('edited: an untouched receipt is not edited',
  ED.wasEdited(SNAP, asStored()) === false);
check('edited: a corrected total is edited, and says which field',
  ED.wasEdited(SNAP, asStored({ total: 26.50 })) === true &&
  ED.changedFields(SNAP, asStored({ total: 26.50 })).join(',') === 'total',
  JSON.stringify(ED.changedFields(SNAP, asStored({ total: 26.50 }))));
check('edited: several corrections are all reported',
  ED.changedFields(SNAP, asStored({ total: 26.5, category: 'Business Meals' })).join(',') === 'total,category');

// Tyler's two real corrections, which are what this exists to capture.
check('edited: Safeway tax 3.49 -> 0.40 is a salesTax correction',
  ED.changedFields({ salesTax: 3.49 }, { salesTax: 0.40 }).join(',') === 'salesTax');
check('edited: Target total 25.00 -> 26.50 is a total correction',
  ED.changedFields({ total: 25.00 }, { total: 26.50 }).join(',') === 'total');

// NULL, not false. A row scanned before the snapshot column existed has no
// evidence either way, and reporting it as "unedited" would credit the parser
// with an answer nobody checked — inflating every future accuracy measurement.
check('edited: no snapshot means unknown, never "not edited"',
  ED.wasEdited(null, asStored()) === null &&
  ED.changedFields(null, asStored()) === null);
check('edited: a corrupt snapshot reads as unknown rather than throwing',
  ED.readSnapshot('{not json') === null && ED.wasEdited(ED.readSnapshot('{not json'), asStored()) === null);
check('edited: a JSON snapshot round-trips',
  ED.readSnapshot(JSON.stringify(SNAP)).merchant === 'Target');

// Money compares in whole cents: float arithmetic makes a sub-cent difference
// a real possibility, and it is not a user correction.
check('edited: a sub-cent float difference is not a correction',
  ED.wasEdited({ total: 0.1 + 0.2 }, { total: 0.3 }) === false, String(0.1 + 0.2));
check('edited: null tax and a typed tax are different',
  ED.changedFields({ salesTax: null }, { salesTax: 1.5 }).join(',') === 'salesTax');
check('edited: null tax left alone is not a correction',
  ED.wasEdited({ salesTax: null, merchant: '', date: '', total: null, category: '' },
               { salesTax: null, merchant: '', date: '', total: null, category: '' }) === false);

// Merchant compares case- and whitespace-insensitively: "target" and "Target "
// are the same answer, and flagging them would bury real corrections in noise.
check('edited: merchant case and padding are not a correction',
  ED.wasEdited({ merchant: 'target ' }, { merchant: 'Target' }) === false);

// Notes and taxRate are deliberately NOT compared. Notes are never parsed, and
// taxRate has four possible sources (printed, city memory, derived, last used),
// so a difference there says nothing about the parser.
check('edited: notes are not evidence about the parser',
  ED.COMPARED.indexOf('notes') === -1 && ED.COMPARED.indexOf('taxRate') === -1);

// snapshotOf freezes the CLASSIFIER's answer. taxTotal is the classifier's name
// for sales tax, and a zero or absent one is null (no value), not 0.
const snapped = ED.snapshotOf({ merchant: 'Costco', date: '2026-08-01', total: 140.35, taxTotal: 0, category: 'Uncategorized', confidence: 'low' });
check('edited: snapshotOf maps taxTotal -> salesTax and 0 -> null',
  snapped.salesTax === null && snapped.total === 140.35 && snapped.merchant === 'Costco',
  JSON.stringify(snapped));
check('edited: snapshotOf on an empty parse does not throw',
  ED.snapshotOf({}).merchant === '' && ED.snapshotOf(null).total === null);

// ---------------------------------------------------------------------------
// The hidden developer switch (devMode.js)
//
// Seven taps on the version stamp. Pure so the rule is a test rather than
// something verified by tapping a phone seven times.
// ---------------------------------------------------------------------------
const DM = require('../src/lib/devMode.js');

// A deliberate run of taps unlocks; each is 200ms after the last.
let st = { count: 0, lastAt: 0 };
let unlockedAt = 0;
for (let i = 1; i <= DM.TAPS_TO_UNLOCK; i++) {
  st = DM.tap(st, i * 200);
  if (st.unlocked) unlockedAt = i;
}
check(`devmode: ${DM.TAPS_TO_UNLOCK} quick taps unlock, and not fewer`,
  unlockedAt === DM.TAPS_TO_UNLOCK, unlockedAt);

// A slow tap restarts the count — otherwise seven presses spread over a minute
// of idle scrolling would enable it by accident.
let slow = { count: 0, lastAt: 0 };
for (let i = 0; i < 6; i++) slow = DM.tap(slow, i * 200);
const afterPause = DM.tap(slow, 6 * 200 + DM.TAP_GAP_MS + 1);
check('devmode: a pause restarts the count',
  afterPause.unlocked === false && afterPause.count === 1, JSON.stringify(afterPause));

// Silent the whole way. A countdown tells someone who tapped by accident that
// there is something here to find, which is the opposite of a hidden control
// (Tyler's call, 2026-09-02). Every tap before the unlock says nothing.
let quiet = { count: 0, lastAt: 0 };
let saidSomething = false;
for (let i = 1; i < DM.TAPS_TO_UNLOCK; i++) {
  quiet = DM.tap(quiet, i * 100);
  if (quiet.message !== null) saidSomething = true;
}
check('devmode: nothing is announced before the unlock',
  saidSomething === false && quiet.unlocked === false, quiet.message);

const revealed = DM.tap(quiet, DM.TAPS_TO_UNLOCK * 100);
check('devmode: the confirmation only appears after the unlock',
  revealed.unlocked === true && typeof revealed.message === 'string', JSON.stringify(revealed));

check('devmode: a null starting state does not throw',
  DM.tap(null, 0).count === 1);

// ---------------------------------------------------------------------------
// Feedback attachments (feedback.js)
//
// This is where the "Data Not Collected" label is kept or lost, so the rules
// are tested rather than trusted. Apple's optional-disclosure criteria and the
// reasoning are in feedback.js and D-059.
// ---------------------------------------------------------------------------
const FB = require('../src/lib/feedback.js');

const MB = 1024 * 1024;
const imgs = [
  { id: 1, imagePath: '/a.jpg', size: 3 * MB },
  { id: 2, imagePath: '/b.jpg', size: 3 * MB },
  { id: 3, imagePath: '/c.jpg', size: 3 * MB },
  { id: 4, imagePath: '/d.jpg', size: 3 * MB },
];

// A bounced support email is a SILENT failure — the user tapped Send, watched it
// leave, and nothing arrived. So the cap is enforced, and what did not fit is
// reported rather than dropped quietly.
const picked = FB.selectImages(imgs, 8 * MB);
check('feedback: images are capped at the size limit',
  picked.chosen.length === 2 && picked.bytes === 6 * MB, JSON.stringify(picked.bytes));
check('feedback: what did not fit is counted, not silently dropped',
  picked.skipped === 2, picked.skipped);
check('feedback: everything fits when it fits',
  FB.selectImages(imgs, 100 * MB).skipped === 0);
check('feedback: a receipt with no image is never attached',
  FB.selectImages([{ id: 9, imagePath: null, size: 10 }], 8 * MB).chosen.length === 0);
check('feedback: a zero-byte or unreadable image is skipped',
  FB.selectImages([{ id: 9, imagePath: '/x.jpg', size: 0 }], 8 * MB).chosen.length === 0);
check('feedback: no receipts does not throw',
  FB.selectImages([], 8 * MB).chosen.length === 0 && FB.selectImages(null).chosen.length === 0);

// The body restates what was attached, so a user reading the sent message later
// can still see what they sent — "it is clear to the user what data is
// collected" has to be true in the artifact, not only in a dismissed screen.
const bodyNone = FB.buildBody({ message: 'hello', version: 'v1 r23', receiptCount: 4 });
check('feedback: attaching nothing says so in the body',
  bodyNone.indexOf('Attached: nothing') !== -1, bodyNone);
check('feedback: the message and version survive into the body',
  bodyNone.indexOf('hello') === 0 && bodyNone.indexOf('v1 r23') !== -1);

const bodyBoth = FB.buildBody({
  message: 'wrong total', version: 'v1 r23', receiptCount: 1,
  includeDiagnostics: true, includeImages: true, imageCount: 1,
});
check('feedback: each attachment is named in the body',
  bodyBoth.indexOf(FB.ATTACHMENT_LABELS.diagnostics) !== -1
  && bodyBoth.indexOf(FB.ATTACHMENT_LABELS.images) !== -1, bodyBoth);

// The label text is what the user reads on the checkbox AND in the sent mail.
// "no photos" on the diagnostics option is load-bearing: it is the difference
// between someone attaching receipt text and thinking they attached pictures.
check('feedback: the diagnostics option states that it carries no photos',
  /no photos/i.test(FB.ATTACHMENT_LABELS.diagnostics), FB.ATTACHMENT_LABELS.diagnostics);

check('feedback: a scan report and general feedback have distinguishable subjects',
  FB.buildSubject('scan', 'v1').indexOf('scanning problem') !== -1
  && FB.buildSubject('general', 'v1').indexOf('scanning problem') === -1);

// ---------------------------------------------------------------------------
// Merchant from the shop's own domain (D-063)
//
// Real receipts routinely yield nothing usable from their header. Every one of
// these came out of the corpus wrong, and the merchant is what a CPA reads on
// the export and what merchant-memory keys off.
// ---------------------------------------------------------------------------
const bp = C.parseReceipt(fx('corpus/basspro-2026-08-02.txt'));
check('merchant: Bass Pro from its domain, not the truncated header',
  bp.merchant === 'Bass Pro Shops', bp.merchant);

const cab = C.parseReceipt(fx('corpus/cabelas-2026-08-08.txt'));
check("merchant: Cabela's from a domain OCR broke as \"CABELAS. COM\"",
  cab.merchant === "Cabela's", cab.merchant);

// THE TRAP. This receipt has an entire second receipt appended to it, so
// "cabelas. com/careers" appears at line 43 — after "target circle" at line 27.
// Taking any match would name it Cabela's; taking the EARLIEST names it Target.
const tgt = C.parseReceipt(fx('corpus/target-column-2026-08-07.txt'));
check('merchant: the earliest marker wins, so an appended receipt cannot steal it',
  tgt.merchant === 'Target', tgt.merchant);
check('merchant: fixing Target did not disturb its total', tgt.total === 26.50, tgt.total);

const sfw = C.parseReceipt(fx('corpus/safeway-double-column.txt'));
check('merchant: trailing OCR junk is dropped ("Safeway €)." -> "Safeway")',
  sfw.merchant === 'Safeway', sfw.merchant);

// A slogan still outranks a domain: the Home Depot receipt never prints the
// name and the slogan is the stronger signal.
const hd = C.parseReceipt(fx('corpus/homedepot-slogan-2026-08-17.txt'));
check('merchant: a slogan still outranks a domain marker',
  hd.merchant === 'Home Depot' && hd.category === 'Supplies & Materials', hd.merchant);

// The two Costco receipts print no name and no domain — OCR mangled the header
// to "Bw Yai Grup" and "Howat Kai #1", because a Costco receipt prints the
// warehouse location and never the word Costco. There is nothing to read, so
// the merchant comes from the receipt's own vocabulary instead (FINGERPRINTS).
const cos = C.parseReceipt(fx('corpus/costco-1.txt'));
check('merchant: Costco from its receipt vocabulary, with no name on the paper',
  cos.merchant === 'Costco' && cos.total === 140.35, `${cos.merchant} / ${cos.total}`);
const cos2 = C.parseReceipt(fx('corpus/costco-2-fsa.txt'));
check('merchant: the second Costco dump too, from a different marker set',
  cos2.merchant === 'Costco' && cos2.total === 172.37, `${cos2.merchant} / ${cos2.total}`);

// The guard that makes the above safe, and the reason two markers are required:
// Safeway prints "TOTAL NUMBER OF ITEMS SOLD" as well. On a one-marker
// threshold every Safeway receipt would have been renamed Costco. Pinned so a
// later marker addition cannot quietly lower the bar.
check('merchant: one shared marker is not a fingerprint — Safeway stays Safeway',
  sfw.merchant === 'Safeway', sfw.merchant);

// ---- Moving trucks land on Schedule C line 20a, not Travel (D-068) ----
//
// The IRS line is what the rental is FOR, not what it has wheels on: 24a is
// travel away from home overnight, 20a is "vehicles, machinery, or equipment"
// rented to do a job. So Hertz and U-Haul go to different lines on purpose.

const uhaul = C.classify(
  'U-HAUL TRUCK RENTAL\n2211 Kalihi St\nHonolulu HI\n' +
  'TRUCK 15FT   1 DAY\nMILEAGE 42 @ 0.99\nENV COVERAGE\nTOTAL  118.57',
  'U-Haul');
check('trucks: U-Haul is Equipment Rental (line 20a)',
  uhaul.name === 'Equipment Rental', uhaul.name);

const penske = C.classify('PENSKE TRUCK RENTAL\nRESERVATION 88213\n26FT BOX\nTOTAL 249.00',
  'Penske Truck Rental');
check('trucks: Penske too', penske.name === 'Equipment Rental', penske.name);

const ryder = C.classify('RYDER TRUCK RENTAL\nUNIT 4471\nDAILY RATE\nTOTAL 310.00',
  'Ryder Truck Rental');
check('trucks: Ryder too', ryder.name === 'Equipment Rental', ryder.name);

// Each truck brand has a sibling business that a bare brand keyword would
// misfile. These are the cases that forced every keyword to be scoped.
const storage = C.classify('U-HAUL SELF STORAGE\nUNIT 214\nMONTHLY RENT\nTOTAL 89.00', 'U-Haul');
check('trucks: U-Haul SELF STORAGE stays on line 20b, not 20a',
  storage.name === 'Rent & Lease', storage.name);

const dealer = C.classify('PENSKE CHEVROLET\nOIL CHANGE\nTOTAL 79.00', 'Penske Chevrolet');
check('trucks: a Penske DEALERSHIP is not a truck rental',
  dealer.name !== 'Equipment Rental', dealer.name);

// The collision this could easily have caused: Budget is two businesses.
// Travel & Lodging owns "budget rent"; Equipment Rental owns "budget truck".
const budgetCar = C.classify('BUDGET RENT A CAR\nLIHUE AIRPORT\nCOMPACT 3 DAYS\nTOTAL 187.44',
  'Budget Rent A Car');
check('trucks: a Budget CAR rental is still Travel (line 24a)',
  budgetCar.name === 'Travel & Lodging', budgetCar.name);

const budgetTruck = C.classify('BUDGET TRUCK RENTAL\n16FT TRUCK\nONE WAY\nTOTAL 232.10',
  'Budget Truck Rental');
check('trucks: a Budget TRUCK rental is Equipment Rental (line 20a)',
  budgetTruck.name === 'Equipment Rental', budgetTruck.name);

// Passenger-car rentals must not have been dragged along by the change.
const hertz = C.classify('HERTZ\nRENTAL CAR\nMIDSIZE 2 DAYS\nTOTAL 143.88', 'Hertz');
check('trucks: Hertz is untouched and still Travel',
  hertz.name === 'Travel & Lodging', hertz.name);

// And the line label the export depends on.
check('trucks: the 20a label is what the exporter writes',
  uhaul.scheduleC.indexOf('20a') !== -1, uhaul.scheduleC);

// ---- Free-scan meter (capture screen, free tier only) ----

check('meter: Pro sees no meter at all, by design',
  G.freeScanMeter({ isPro: true, scansThisMonth: 3, limit: 10 }) === null, 'not null');

const fresh = G.freeScanMeter({ isPro: false, scansThisMonth: 0, limit: 10 });
check('meter: a fresh month is an empty bar and full headroom',
  fresh.remaining === 10 && fresh.fill === 0 && !fresh.exhausted, JSON.stringify(fresh));

const mid = G.freeScanMeter({ isPro: false, scansThisMonth: 3, limit: 10 });
check('meter: counts what is LEFT, not what is spent',
  mid.remaining === 7 && mid.label === '7 of 10 free scans left this month', mid.label);

// The bar fills as the month is spent, so the warning colour at the limit has
// a bar to be drawn on. Filling it with the fraction REMAINING made the
// exhausted bar 0% wide — the one state the colour existed for.
check('meter: the bar tracks what is used, so it is full when exhausted',
  mid.fill === 0.3, String(mid.fill));

const one = G.freeScanMeter({ isPro: false, scansThisMonth: 9, limit: 10 });
check('meter: the last scan reads singular, not "1 of 10 free scans"',
  one.label === '1 free scan left this month', one.label);

const spent = G.freeScanMeter({ isPro: false, scansThisMonth: 10, limit: 10 });
check('meter: at the limit it is exhausted, with a full bar',
  spent.remaining === 0 && spent.exhausted && spent.fill === 1, JSON.stringify(spent));

// The case that produces "-2 left" if nobody clamps: a restored archive or a
// month boundary can put the count past the limit.
const over = G.freeScanMeter({ isPro: false, scansThisMonth: 14, limit: 10 });
check('meter: scanning past the limit still reads 0 left, never negative',
  over.remaining === 0 && over.used === 10 && over.fill === 1, JSON.stringify(over));

// `exhausted` delegates to isOverFreeLimit rather than restating it, so this
// cannot drift. Asserted on both sides of the boundary anyway, because the
// delegation is the thing worth pinning.
check('meter: exhausted IS the gate, on both sides of the boundary',
  G.freeScanMeter({ isPro: false, scansThisMonth: 9, limit: 10 }).exhausted ===
    G.isOverFreeLimit({ isPro: false, scansThisMonth: 9, limit: 10 }) &&
  G.freeScanMeter({ isPro: false, scansThisMonth: 10, limit: 10 }).exhausted ===
    G.isOverFreeLimit({ isPro: false, scansThisMonth: 10, limit: 10 }) &&
  G.freeScanMeter({ isPro: false, scansThisMonth: 10, limit: 10 }).exhausted === true,
  'disagree');

// ---------------------------------------------------------------------------
// paths.js — receipt photographs survive the container path changing.
//
// The bug these pin: iOS moved the app's Data container between build 5 and
// build 6, every row still held a path under the old container UUID, and the
// Receipts tab showed receipts with no photographs. The files had not moved
// relative to the container; the stored string had gone stale.
const P = require('../src/lib/paths.js');

const OLD = 'file:///var/mobile/Containers/Data/Application/AAAA-1111/Documents/receipts/2026-01-02.jpg';
const NEW_DIR = 'file:///var/mobile/Containers/Data/Application/BBBB-2222/Documents/';

check('paths: an absolute URI stores as a relative one',
  P.storedPath(OLD) === 'receipts/2026-01-02.jpg', P.storedPath(OLD));

check('paths: an already-stored path is left alone',
  P.storedPath('receipts/x.jpg') === 'receipts/x.jpg', P.storedPath('receipts/x.jpg'));

check('paths: a bare file name is refused too, for the same reason',
  P.storedPath('x.jpg') === null, P.storedPath('x.jpg'));

// Guessing here would be worse than refusing: relocating a path from some
// other directory names a file that does not exist, and whatever deletes it
// then reports success while the real photograph stays on the device.
check('paths: a path outside the receipts directory is refused, not relocated',
  P.storedPath('file:///var/tmp/ImageManipulator/ABC.jpg') === null,
  P.storedPath('file:///var/tmp/ImageManipulator/ABC.jpg'));

check('paths: no documentDirectory means no path, never a relative one',
  P.absolutePath('receipts/x.jpg', null) === null, P.absolutePath('receipts/x.jpg', null));

check('paths: the write directory and the read path are joined the same way',
  P.dirPath('file:///docs') === 'file:///docs/receipts/'
    && P.dirPath('file:///docs/') === 'file:///docs/receipts/'
    && P.dirPath(null) === null,
  P.dirPath('file:///docs'));

check('paths: null in, null out', P.storedPath(null) === null && P.absolutePath(null, NEW_DIR) === null, 'not null');

// The whole point: a row written under the OLD container resolves against the
// NEW one without any migration having run.
check('paths: a stale absolute row still resolves to today\'s container',
  P.absolutePath(OLD, NEW_DIR) === NEW_DIR + 'receipts/2026-01-02.jpg', P.absolutePath(OLD, NEW_DIR));

check('paths: a stored path resolves to today\'s container',
  P.absolutePath('receipts/x.jpg', NEW_DIR) === NEW_DIR + 'receipts/x.jpg',
  P.absolutePath('receipts/x.jpg', NEW_DIR));

check('paths: a documentDirectory without a trailing slash still joins cleanly',
  P.absolutePath('receipts/x.jpg', 'file:///docs') === 'file:///docs/receipts/x.jpg',
  P.absolutePath('receipts/x.jpg', 'file:///docs'));

// `receipts` appearing in the container path must not fool the split.
const TRICKY = 'file:///var/receipts/Data/AAAA/Documents/receipts/y.jpg';
check('paths: the LAST /receipts/ wins, not the first',
  P.storedPath(TRICKY) === 'receipts/y.jpg', P.storedPath(TRICKY));

// ---------------------------------------------------------------------------
// appLock.js — when the Face ID gate closes (D-079).
const AL = require('../src/lib/appLock.js');

check('applock: off means off, even with hardware',
  AL.shouldLock({ enabled: false, available: true, backgroundedAt: null, now: 1000 }) === false);

// The one that matters most: a phone with nothing enrolled must never lock,
// or the owner is shut out of their own receipts with no way back.
check('applock: a phone that cannot unlock is never locked',
  AL.shouldLock({ enabled: true, available: false, backgroundedAt: null, now: 1000 }) === false);

check('applock: a cold start locks',
  AL.shouldLock({ enabled: true, available: true, backgroundedAt: null, now: 1000 }) === true);

// A quick trip to the share sheet or the camera must not demand a face scan on
// the way back. Both sides of the grace period are pinned.
check('applock: a short trip away does not re-lock',
  AL.shouldLock({ enabled: true, available: true, backgroundedAt: 1000, now: 1000 + AL.GRACE_MS - 1 }) === false);

check('applock: a long trip away re-locks',
  AL.shouldLock({ enabled: true, available: true, backgroundedAt: 1000, now: 1000 + AL.GRACE_MS }) === true);

// A clock change can make "time away" negative. Asking again is the safe answer.
check('applock: a backwards clock locks rather than unlocking',
  AL.shouldLock({ enabled: true, available: true, backgroundedAt: 5000, now: 1000 }) === true);

check('applock: no options does not throw', AL.shouldLock() === false);

// The state machine, not only the predicate. The bug that review caught before
// r31 shipped lived entirely here: `active` judged against a mark no unlock
// cleared, so the Face ID prompt's own dismissal re-locked the app.
const ON = { enabled: true, available: true };
const OFF = { enabled: false, available: true };

let L = AL.reduce(null, { type: 'start', now: 0 }, ON);
check('lock machine: a cold start locks and asks once',
  L.locked === true && L.prompts === 1, JSON.stringify(L));

// THE LOOP. iOS fires inactive then active around the Face ID sheet. Neither
// may be read as time away.
L = AL.reduce(L, { type: 'inactive', now: 10 }, ON);
L = AL.reduce(L, { type: 'unlocked', now: 20 }, ON);
const afterPrompt = AL.reduce(L, { type: 'active', now: 30 }, ON);
check('lock machine: the prompt dismissal does not re-lock',
  afterPrompt.locked === false && afterPrompt.covered === false, JSON.stringify(afterPrompt));

// A notification banner covers, so the snapshot cannot carry the receipt list,
// and uncovers on the way back without asking for anything.
let banner = AL.reduce({ ...AL.INITIAL }, { type: 'inactive', now: 100 }, ON);
check('lock machine: resigning active covers without asking',
  banner.covered === true && banner.locked === false, JSON.stringify(banner));
banner = AL.reduce(banner, { type: 'active', now: 200 }, ON);
check('lock machine: coming back uncovers', banner.covered === false && banner.locked === false);

// A real trip away, inside the grace period.
let quick = AL.reduce({ ...AL.INITIAL }, { type: 'background', now: 1000 }, ON);
check('lock machine: backgrounding covers', quick.covered === true);
quick = AL.reduce(quick, { type: 'active', now: 1000 + AL.GRACE_MS - 1 }, ON);
check('lock machine: a short trip does not lock',
  quick.locked === false && quick.covered === false && quick.backgroundedAt === null, JSON.stringify(quick));

// The same trip, past the grace period.
let long = AL.reduce({ ...AL.INITIAL }, { type: 'background', now: 1000 }, ON);
long = AL.reduce(long, { type: 'active', now: 1000 + AL.GRACE_MS }, ON);
check('lock machine: a long trip locks and asks',
  long.locked === true && long.prompts === 1, JSON.stringify(long));

// A cancelled prompt leaves `locked` true, so a boolean cannot re-arm the ask.
let cancelled = AL.reduce({ ...AL.INITIAL }, { type: 'start', now: 0 }, ON);
cancelled = AL.reduce(cancelled, { type: 'background', now: 1000 }, ON);
const reasked = AL.reduce(cancelled, { type: 'active', now: 1000 + AL.GRACE_MS }, ON);
check('lock machine: a still-locked app asks again after another trip away',
  reasked.locked === true && reasked.prompts === cancelled.prompts + 1,
  reasked.prompts + ' vs ' + cancelled.prompts);

// Lock off: no cover, no lock, nothing.
let off = AL.reduce({ ...AL.INITIAL }, { type: 'start', now: 0 }, OFF);
off = AL.reduce(off, { type: 'inactive', now: 10 }, OFF);
check('lock machine: with the lock off nothing covers and nothing locks',
  off.locked === false && off.covered === false, JSON.stringify(off));

check('lock machine: an unknown event changes nothing',
  AL.reduce(AL.INITIAL, { type: 'nonsense', now: 1 }, ON) === AL.INITIAL);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
