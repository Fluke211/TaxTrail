#!/usr/bin/env node
/*
 * Synthetic receipt corpus.
 *
 * The real corpus (__tests__/corpus/) is Apple Vision output from Tyler's own
 * receipts. It is the only on-distribution data there is, and it grows one
 * receipt at a time. This generates thousands of receipts instead — not to
 * replace it, but to cover the *format space* deliberately rather than hoping
 * real receipts happen to hit each case.
 *
 * The point is ground truth. Every receipt here is built from known numbers, so
 * "what should the parser have said" is not a judgement call. That is the one
 * thing scraped or downloaded receipts cannot give you without hand-annotation.
 *
 * WHAT THIS IS NOT: it is not OCR output. Apple Vision has its own line
 * ordering and error modes, and no generator reproduces those faithfully. The
 * noise here is modelled on artifacts visible in the real corpus (a decimal
 * point scanned as a brace, stray glyphs, columns collapsing) but a receipt
 * that passes here is not proven to pass on device. Treat a synthetic pass as
 * necessary, never sufficient.
 *
 * Deterministic: same seed, same corpus. Nothing is written to the repo —
 * scripts/score-synthetic.js generates and scores in memory.
 */
'use strict';

// mulberry32 — small, fast, and reproducible across Node versions, which
// matters more here than statistical quality.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const money = (cents) => (cents / 100).toFixed(2);
const moneyGrouped = (cents) => (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/, ',');

// ---------------------------------------------------------------- variations
// Each axis is a thing that has broken a parser somewhere. The score report
// breaks results down by axis, so a failure names the format rather than just
// the receipt.

const TOTAL_LABELS = [
  'TOTAL', 'GRAND TOTAL', 'TOTAL DUE', 'AMOUNT DUE', 'BALANCE DUE',
  'TOTAL SALE', 'AMOUNT CHARGED', 'PURCHASE TOTAL', 'TO PAY', 'TOTAL PAYMENT',
];

const TAX_LABELS = [
  'TAX', 'SALES TAX', 'TOTAL TAX', 'STATE TAX', 'TAX 1', 'GET', 'HI GET',
];

const SUBTOTAL_LABELS = ['SUBTOTAL', 'SUB-TOTAL', 'SUB TOTAL', 'Subtotal'];

// Merchants carry category keywords, so classification is exercised too. Each
// entry names the Schedule C category the receipt should land in.
const MERCHANTS = [
  { name: 'HOME DEPOT', city: 'HONOLULU HI', cat: 'Supplies & Materials' },
  { name: 'LOWES', city: 'AIEA HI', cat: 'Supplies & Materials' },
  { name: 'OFFICE DEPOT', city: 'HONOLULU HI', cat: 'Office Expense' },
  { name: 'STAPLES', city: 'PEARL CITY HI', cat: 'Office Expense' },
  { name: 'SHELL', city: 'KAILUA HI', cat: 'Car & Truck Expenses' },
  { name: 'CHEVRON', city: 'HONOLULU HI', cat: 'Car & Truck Expenses' },
  { name: 'COSTCO WHOLESALE', city: 'HONOLULU HI', cat: null },
  { name: 'SAFEWAY', city: 'HONOLULU HI', cat: null },
  { name: 'THE RUSTY GRILL', city: 'HONOLULU HI', cat: 'Meals & Entertainment' },
  { name: 'MARRIOTT WAIKIKI', city: 'HONOLULU HI', cat: 'Travel' },
  { name: 'DELTA AIR LINES', city: '', cat: 'Travel' },
  { name: 'VERIZON WIRELESS', city: 'HONOLULU HI', cat: 'Utilities' },
  { name: 'ADOBE INC', city: '', cat: 'Office Expense' },
  { name: 'UNITED PARCEL SERVICE', city: 'HONOLULU HI', cat: 'Office Expense' },
];

const ITEMS = [
  '2X4 LUMBER', 'DRYWALL SCREWS', 'PAINT ROLLER', 'COPY PAPER 8.5X11',
  'TONER CARTRIDGE', 'USB-C CABLE', 'UNLEADED FUEL', 'COFFEE', 'SANDWICH',
  'NOTEBOOK', 'BATTERIES AA', 'EXTENSION CORD', 'SAFETY GLASSES', 'DUCT TAPE',
];

// OCR artifacts observed in the real corpus, not invented: a decimal point
// scanned as a brace/bracket/pipe (the MONEY regex tolerates these on purpose),
// stray glyphs in the header, and collapsed spacing.
function ocrNoise(r, line, level) {
  if (level === 'none') return line;
  let out = line;
  if (level === 'heavy' && r() < 0.25) {
    out = out.replace(/\.(\d{2})(?!\d)/, (m, d) => pick(r, ['{', '[', '|']) + d);
  }
  if (r() < 0.2) out = out.replace(/ {2,}/g, ' '.repeat(int(r, 1, 8)));
  if (level === 'heavy' && r() < 0.15) out += ' ' + pick(r, ['€).', '¥®', 'Co', 'LT', '§']);
  return out;
}

function pad(left, right, width) {
  const gap = Math.max(2, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

function fmtDate(r, d, style) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  switch (style) {
    case 'slash2': return `${mm}/${dd}/${String(yyyy).slice(2)}`;
    case 'slash4': return `${mm}/${dd}/${yyyy}`;
    case 'iso': return `${yyyy}-${mm}-${dd}`;
    case 'dash': return `${mm}-${dd}-${yyyy}`;
    case 'named': return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${yyyy}`;
    default: return `${mm}/${dd}/${yyyy}`;
  }
}

/**
 * Build one receipt plus the truth about it.
 *
 * Expected values describe what the receipt SAYS, never what the parser is
 * assumed to do. If the parser disagrees with one of these, that is a finding
 * about the parser, not a broken fixture — which is the whole reason for
 * generating from known numbers.
 */
function makeReceipt(r, i) {
  const merchant = pick(r, MERCHANTS);
  const isRestaurant = /GRILL|CAFE|RESTAURANT|DINER/.test(merchant.name);
  const axes = {
    totalLabel: pick(r, TOTAL_LABELS),
    taxLabel: pick(r, TAX_LABELS),
    layout: pick(r, ['same-line', 'same-line', 'next-line', 'two-column']),
    subtotal: r() < 0.75,
    printedRate: r() < 0.35,
    coupon: r() < 0.3,
    distractors: r() < 0.6,
    dateStyle: pick(r, ['slash2', 'slash4', 'iso', 'dash', 'named']),
    noise: pick(r, ['none', 'light', 'light', 'heavy']),
    subtotalTrap: false,
    // Harder shapes, all common on US receipts:
    splitTax: r() < 0.2,      // state + county on separate lines
    tip: false,               // set below — restaurants only
    bigTicket: r() < 0.15,    // four figures, so thousands separators appear
    taxNextLine: r() < 0.15,  // label and rate on one line, amount on the next
  };
  axes.tip = isRestaurant && r() < 0.6;

  // Money in integer cents throughout — float arithmetic on prices is how
  // off-by-a-penny expectations get baked into a corpus.
  const n = int(r, 1, 6);
  const items = [];
  let subtotalC = 0;
  for (let k = 0; k < n; k++) {
    const priceC = axes.bigTicket ? int(r, 20000, 180000) : int(r, 99, 8999);
    subtotalC += priceC;
    items.push({ name: pick(r, ITEMS), priceC });
  }

  let couponC = 0;
  if (axes.coupon) {
    // Never more than half the basket: a coupon that wipes the subtotal to a
    // cent produces a receipt no shop prints, and the resulting $0.00 tax line
    // tests nothing except the generator's own carelessness.
    couponC = Math.min(int(r, 50, 500), Math.floor(subtotalC / 2));
    subtotalC -= couponC;
  }

  const rate = pick(r, [0.04, 0.04712, 0.045, 0.0725, 0.08, 0.0825, 0.10]);
  const taxC = Math.round(subtotalC * rate);
  const totalC = subtotalC + taxC;
  const tipC = axes.tip ? Math.round(subtotalC * pick(r, [0.15, 0.18, 0.2])) : 0;

  // The subtotal-beats-total trap: when items are pricey the subtotal line is a
  // larger number sitting near the word "total". A parser that takes the
  // biggest number, or the first "total"-ish line, gets this wrong.
  if (axes.subtotal && subtotalC > 50000) axes.subtotalTrap = true;

  const W = 40;
  const L = [];
  L.push(merchant.name);
  if (merchant.city) {
    L.push(`${int(r, 100, 9999)} ${pick(r, ['KEAHOLE ST', 'DILLINGHAM BLVD', 'KAPIOLANI BLVD', 'MAIN ST'])}`);
    L.push(merchant.city + ' ' + int(r, 96701, 96826));
  }
  L.push(`Store #${int(r, 100, 9999)}`);
  L.push('');

  for (const it of items) {
    if (axes.layout === 'two-column') {
      // "Price You Pay" style: regular price then discounted price. The second
      // number is the one that counts, and both sit on one line.
      L.push(pad(`${int(r, 1000000, 9999999)} ${it.name}`,
        `${money(it.priceC + int(r, 1, 200))} ${money(it.priceC)}`, W + 12));
    } else {
      L.push(pad(it.name, money(it.priceC), W));
    }
  }

  if (axes.coupon) {
    // Credits print with a trailing minus, sometimes with a tax-class letter.
    L.push(pad('COUPON', money(couponC) + pick(r, ['-', '-A', '-']), W));
  }

  if (axes.distractors) {
    L.push(`TOTAL NUMBER OF ITEMS SOLD = ${n}`);
    if (r() < 0.5) L.push(pad('Points Earned Today', String(int(r, 1, 99)), W));
    if (r() < 0.4) L.push(`AUTH: ${int(r, 100000, 999999)}`);
    // FSA footers are not the total and not sales tax — they exist to be ignored.
    if (r() < 0.25) L.push(pad('FSA TAX AMT', money(int(r, 100, 2000)), W));
  }

  if (axes.subtotal) L.push(pad(pick(r, SUBTOTAL_LABELS), money(subtotalC), W));

  const M = axes.bigTicket ? moneyGrouped : money;
  const rateStr = (rate * 100).toFixed(rate === 0.04712 ? 3 : 2);
  const taxLine = axes.printedRate ? `${axes.taxLabel} ${rateStr}%` : axes.taxLabel;

  if (axes.splitTax) {
    // State and county printed separately; the parser has to add them up or
    // take the larger, and either way must not stop at the first one.
    const stateC = Math.round(taxC * 0.6);
    L.push(pad('STATE TAX', M(stateC), W));
    L.push(pad('COUNTY TAX', M(taxC - stateC), W));
  } else if (axes.taxNextLine) {
    L.push(taxLine);
    L.push(M(taxC));
  } else {
    L.push(pad(taxLine, M(taxC), W));
  }

  if (axes.layout === 'next-line') {
    L.push(axes.totalLabel);
    L.push(M(totalC));
  } else {
    L.push(pad(axes.totalLabel, M(totalC), W));
  }

  if (axes.tip) {
    // A tip is added AFTER the printed total on a restaurant slip, so the
    // amount a user owes is the last number, not the labelled "TOTAL".
    L.push(pad('TIP', M(tipC), W));
    L.push(pad('AMOUNT PAID', M(totalC + tipC), W));
  }

  if (axes.distractors) {
    L.push(pad('CHANGE', '0.00', W));
    L.push(pad(pick(r, ['VISA', 'MASTERCARD', 'DEBIT']), M(totalC + tipC), W));
    L.push(`CARD ************${int(r, 1000, 9999)}`);
  }

  const d = new Date(2026, int(r, 0, 11), int(r, 1, 28));
  L.push(`${fmtDate(r, d, axes.dateStyle)}  ${int(r, 0, 23)}:${String(int(r, 0, 59)).padStart(2, '0')}`);

  const text = L.map((l) => ocrNoise(r, l, axes.noise)).join('\n');

  // On a restaurant slip the printed "TOTAL" is pre-tip and the amount actually
  // paid is the last line. Which of those is "the receipt total" is a product
  // question — for a tax app the deductible figure is what was paid — so it is
  // reported separately rather than scored as a parsing failure.
  const expected = { total: (totalC + tipC) / 100 };
  if (axes.tip) expected.totalPreTip = totalC / 100;
  // With the tax split across two lines there is no single printed tax figure,
  // so asserting one would be asserting a convention rather than a fact.
  if (!axes.splitTax) expected.taxTotal = taxC / 100;
  if (axes.subtotal) expected.subtotal = subtotalC / 100;

  return {
    name: `synth-${String(i).padStart(5, '0')}-${merchant.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    text,
    expected,
    axes,
    merchant: merchant.name,
    expectedCategory: merchant.cat,
  };
}

function generate(seed, count) {
  const r = rng(seed);
  const out = [];
  for (let i = 0; i < count; i++) out.push(makeReceipt(r, i));
  return out;
}

module.exports = { generate, makeReceipt, rng, TOTAL_LABELS, TAX_LABELS };
