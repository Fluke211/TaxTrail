#!/usr/bin/env node
// Classifier scoring harness.
//
// Runs the parser over every raw OCR dump in __tests__/corpus/ and reports what
// it produced, so parser work is measured rather than guessed at. Two modes,
// and the first works from day one:
//
//   Triage  — flags receipts the parser handled poorly (no total, no merchant,
//             no date, uncategorized, low confidence). Needs no expected values.
//   Compare — if <name>.expected.json sits next to <name>.txt, checks the
//             fields it specifies and reports mismatches.
//
// Corpus files come from the app's "Parser diagnostics" export: each receipt's
// ocrText becomes one .txt here. See docs/RUNBOOK.md.
//
//   node scripts/score-classifier.js [--verbose]

const fs = require('fs');
const path = require('path');
const C = require('../src/lib/classifier.js');

const DIR = path.join(__dirname, '..', '__tests__', 'corpus');
const verbose = process.argv.includes('--verbose');

if (!fs.existsSync(DIR)) {
  console.error(`No corpus at ${DIR}`);
  process.exit(1);
}
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.txt')).sort();
if (!files.length) {
  console.log('Corpus is empty. Add raw OCR dumps as __tests__/corpus/<name>.txt');
  console.log('(from the app: Summary -> Parser diagnostics)');
  process.exit(0);
}

const issuesFor = (p) => {
  const out = [];
  if (p.total == null) out.push('no-total');
  if (!p.merchant) out.push('no-merchant');
  if (!p.date) out.push('no-date');
  if (p.category === 'Uncategorized') out.push('uncategorized');
  if (p.confidence === 'low') out.push('low-confidence');
  return out;
};

let clean = 0;
const flagged = [];
const mismatches = [];

for (const f of files) {
  const name = f.replace(/\.txt$/, '');
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');
  let parsed;
  try {
    parsed = C.parseReceipt(text);
  } catch (e) {
    flagged.push([name, ['THREW: ' + e.message]]);
    continue;
  }

  const issues = issuesFor(parsed);
  if (issues.length) flagged.push([name, issues]);
  else clean += 1;

  const expPath = path.join(DIR, `${name}.expected.json`);
  if (fs.existsSync(expPath)) {
    const exp = JSON.parse(fs.readFileSync(expPath, 'utf8'));
    for (const [k, want] of Object.entries(exp)) {
      const got = parsed[k];
      const same = typeof want === 'number' && typeof got === 'number'
        ? Math.abs(want - got) < 0.005
        : want === got;
      if (!same) mismatches.push(`${name}.${k}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
  }

  if (verbose) {
    console.log(`\n── ${name}`);
    console.log(`   merchant=${JSON.stringify(parsed.merchant)} date=${parsed.date} ` +
                `total=${parsed.total} tax=${parsed.taxTotal} category=${JSON.stringify(parsed.category)} ` +
                `confidence=${parsed.confidence}`);
  }
}

console.log(`\nCorpus: ${files.length} receipts`);
console.log(`Clean:  ${clean}  (${((clean / files.length) * 100).toFixed(0)}%)`);

if (flagged.length) {
  console.log(`\nFlagged (${flagged.length}):`);
  for (const [name, issues] of flagged) console.log(`  ${name.padEnd(34)} ${issues.join(', ')}`);
}
if (mismatches.length) {
  console.log(`\nExpectation mismatches (${mismatches.length}):`);
  for (const m of mismatches) console.log(`  ${m}`);
}
if (!flagged.length && !mismatches.length) console.log('\nNo issues.');

// Mismatches are real regressions and fail the run; triage flags do not — a
// receipt the parser cannot fully read is a to-do, not a broken build.
process.exit(mismatches.length ? 1 : 0);
