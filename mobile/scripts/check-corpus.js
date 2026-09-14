#!/usr/bin/env node
/*
 * The corpus must be what it claims to be.
 *
 * "Corpus: 37 receipts" was reported to Tyler when only 31 of those files held
 * distinct text: six were byte-identical copies of another fixture under a
 * different name, three of them added in the same change that quoted the number
 * (D-094). A duplicate is worse than useless. It inflates the score, it makes a
 * defect look like it was found on two receipts when it was found on one, and a
 * fix that breaks it breaks the count twice.
 *
 * Also checks every .txt has a pin and vice versa, since an unpinned fixture is
 * scored but never asserted against.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', '__tests__', 'corpus');
const texts = fs.readdirSync(DIR).filter((f) => f.endsWith('.txt'));

let failed = 0;

const byHash = new Map();
for (const f of texts) {
  const body = fs.readFileSync(path.join(DIR, f), 'utf8').trim();
  const h = crypto.createHash('md5').update(body).digest('hex');
  if (!byHash.has(h)) byHash.set(h, []);
  byHash.get(h).push(f);
}

for (const group of byHash.values()) {
  if (group.length > 1) {
    failed++;
    console.error('DUPLICATE receipt text in ' + group.length + ' fixtures:');
    group.forEach((f) => console.error('  ' + f));
    console.error('  Keep one, merge the expectations into it, delete the rest.');
  }
}

for (const f of texts) {
  const pin = f.replace(/\.txt$/, '.expected.json');
  if (!fs.existsSync(path.join(DIR, pin))) {
    failed++;
    console.error('NO EXPECTATION for ' + f + ' (scored, but nothing is asserted)');
  }
}

for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.expected.json'))) {
  const txt = f.replace(/\.expected\.json$/, '.txt');
  if (!fs.existsSync(path.join(DIR, txt))) {
    failed++;
    console.error('ORPHAN EXPECTATION ' + f + ' (no matching .txt)');
  }
}

if (failed) {
  console.error('\n' + failed + ' corpus problem(s).');
  process.exit(1);
}
console.log(texts.length + ' corpus receipts, all distinct, all pinned.');
