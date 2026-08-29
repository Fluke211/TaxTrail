#!/usr/bin/env node
/*
 * Score the parser against the synthetic corpus.
 *
 *   node scripts/score-synthetic.js [--count 2000] [--seed 42] [--verbose]
 *                                   [--dump <dir>] [--update-baseline]
 *
 * Reports a pass rate per FIELD and per FORMAT AXIS, because "83% correct" is
 * not actionable but "AMOUNT CHARGED: 12/47" names the thing to go and fix.
 *
 * Fails only against a committed baseline (synthetic-baseline.json), so this
 * ratchets rather than blocking on a corpus the parser was never going to ace.
 * A parser that gets worse fails; one that is merely imperfect does not.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { generate } = require('./synth-corpus.js');
const C = require('../src/lib/classifier.js');

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? dflt : process.argv[i + 1];
};
const has = (flag) => process.argv.includes(flag);

const COUNT = parseInt(arg('--count', '2000'), 10);
const SEED = parseInt(arg('--seed', '42'), 10);
const BASELINE = path.join(__dirname, 'synthetic-baseline.json');

const receipts = generate(SEED, COUNT);

const FIELDS = ['total', 'taxTotal', 'subtotal'];
const stats = {};
const axisStats = {};
const failures = [];

const bump = (bag, key, ok) => {
  bag[key] = bag[key] || { ok: 0, n: 0 };
  bag[key].n += 1;
  if (ok) bag[key].ok += 1;
};

for (const rec of receipts) {
  let parsed;
  try {
    parsed = C.parseReceipt(rec.text);
  } catch (e) {
    failures.push({ rec, error: String(e) });
    for (const f of FIELDS) if (rec.expected[f] !== undefined) bump(stats, f, false);
    continue;
  }

  const missed = [];
  for (const f of FIELDS) {
    if (rec.expected[f] === undefined) continue;
    // Cent-level equality; these are exact numbers by construction.
    const ok = parsed[f] !== null && parsed[f] !== undefined &&
      Math.abs(parsed[f] - rec.expected[f]) < 0.005;
    bump(stats, f, ok);
    if (!ok) missed.push({ field: f, want: rec.expected[f], got: parsed[f] });
  }

  // Tips now count toward the total (D-042), so they are scored as an ordinary
  // total rather than held in their own bucket.
  if (rec.axes.tip) {
    bump(axisStats, 'tip=yes', parsed.total !== null &&
      Math.abs((parsed.total || 0) - rec.expected.total) < 0.005);
  }

  const dateOk = !!parsed.date;
  bump(stats, 'date(any)', dateOk);
  if (!dateOk) missed.push({ field: 'date', want: '(a date)', got: parsed.date });

  // The total is the field a wrong answer hurts most, so axes are scored on it.
  const totalOk = parsed.total !== null &&
    Math.abs((parsed.total || 0) - rec.expected.total) < 0.005;
  bump(axisStats, `totalLabel=${rec.axes.totalLabel}`, totalOk);
  bump(axisStats, `layout=${rec.axes.layout}`, totalOk);
  bump(axisStats, `noise=${rec.axes.noise}`, totalOk);
  bump(axisStats, `taxLabel=${rec.axes.taxLabel}`, totalOk);
  bump(axisStats, `dateStyle=${rec.axes.dateStyle}`, dateOk);
  if (rec.axes.coupon) bump(axisStats, 'coupon=yes', totalOk);
  if (rec.axes.subtotalTrap) bump(axisStats, 'subtotalTrap=yes', totalOk);
  if (rec.axes.distractors) bump(axisStats, 'distractors=yes', totalOk);

  if (missed.length) failures.push({ rec, missed, parsed });
}

const pct = (o) => (o.n ? (100 * o.ok / o.n) : 0);
const line = (k, o) => `  ${k.padEnd(34)} ${String(o.ok).padStart(5)}/${String(o.n).padEnd(5)}  ${pct(o).toFixed(1)}%`;

console.log(`\nSynthetic corpus — ${COUNT} receipts, seed ${SEED}\n`);
console.log('Fields');
for (const k of Object.keys(stats).sort()) console.log(line(k, stats[k]));

console.log('\nBy format (scored on total, except dateStyle)');
const axisKeys = Object.keys(axisStats).sort((a, b) => pct(axisStats[a]) - pct(axisStats[b]));
for (const k of axisKeys) console.log(line(k, axisStats[k]));

const worst = axisKeys.filter((k) => pct(axisStats[k]) < 95).slice(0, 8);
if (worst.length) {
  console.log('\nWeakest formats — these are the ones worth fixing:');
  for (const k of worst) console.log(`  ${k}  (${pct(axisStats[k]).toFixed(1)}%)`);
}

if (has('--verbose') && failures.length) {
  console.log(`\n--- first 5 of ${failures.length} failures ---`);
  for (const f of failures.slice(0, 5)) {
    console.log(`\n### ${f.rec.name}  [${JSON.stringify(f.rec.axes)}]`);
    console.log(f.rec.text);
    console.log('->', JSON.stringify(f.missed || f.error));
  }
}

const dumpDir = arg('--dump', null);
if (dumpDir && failures.length) {
  fs.mkdirSync(dumpDir, { recursive: true });
  for (const f of failures.slice(0, 200)) {
    fs.writeFileSync(path.join(dumpDir, `${f.rec.name}.txt`), f.rec.text);
    fs.writeFileSync(path.join(dumpDir, `${f.rec.name}.expected.json`),
      JSON.stringify(f.rec.expected, null, 2) + '\n');
  }
  console.log(`\nWrote ${Math.min(200, failures.length)} failing cases to ${dumpDir}`);
}

const current = {};
for (const k of Object.keys(stats)) current[k] = Number(pct(stats[k]).toFixed(1));

if (has('--update-baseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify({ seed: SEED, count: COUNT, fields: current }, null, 2) + '\n');
  console.log(`\nBaseline written to ${BASELINE}`);
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.log('\nNo baseline yet. Run with --update-baseline to record one.');
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
if (base.seed !== SEED || base.count !== COUNT) {
  console.log(`\nBaseline was recorded at seed ${base.seed} / count ${base.count}; ` +
    `this run is seed ${SEED} / count ${COUNT}. Not comparing.`);
  process.exit(0);
}

// A tenth of a point of slack absorbs nothing real — these numbers are exact
// for a given seed — but keeps a rounding change from reading as a regression.
let regressed = false;
console.log('\nAgainst baseline');
for (const k of Object.keys(base.fields)) {
  const now = current[k];
  const was = base.fields[k];
  if (now === undefined) continue;
  const delta = now - was;
  const mark = delta < -0.1 ? 'REGRESSED' : delta > 0.1 ? 'improved ' : 'same     ';
  console.log(`  ${k.padEnd(34)} ${mark}  ${was.toFixed(1)}% -> ${now.toFixed(1)}%`);
  if (delta < -0.1) regressed = true;
}

if (regressed) {
  console.log('\nParser got worse on the synthetic corpus. If the change was ' +
    'deliberate, re-run with --update-baseline.');
  process.exit(1);
}
console.log('\nNo regressions.');
