#!/usr/bin/env node
/*
 * The category count in the App Store copy has to match the code.
 *
 * It has now been wrong twice. The listing originally said 29, a copy pass
 * corrected it to 28 on the recorded ground that "Uncategorized" is the
 * absence of a category rather than one of them, and then a category was
 * added and 28 became wrong again. Nothing caught it, because the copy lives
 * in a Markdown file and a JSON file that no test reads.
 *
 * So the number is derived here instead of trusted: every "<n> categories"
 * claim in the listing and in the screenshot captions has to equal
 * CATEGORIES minus the one that means "not categorized". Adding a category
 * now fails CI until the copy is updated with it, which is the point.
 *
 *   node scripts/check-category-count.js
 */
const fs = require('fs');
const path = require('path');
const { CATEGORIES } = require('../src/lib/classifier.js');

const ROOT = path.join(__dirname, '..', '..');
const NOT_A_CATEGORY = 'Uncategorized';

const names = CATEGORIES.map((c) => c.name);
if (names.indexOf(NOT_A_CATEGORY) === -1) {
  console.error(`FAIL  classifier.js no longer has a "${NOT_A_CATEGORY}" entry.`);
  console.error('      Decide what the user-facing count is and update this check with it.');
  process.exit(1);
}
const expected = names.length - 1;

// Files that state the count in prose a reviewer or a customer reads.
const FILES = ['docs/APP_STORE_LISTING.md', 'tools/screenshots/slots.json'];

let bad = 0;
let found = 0;
for (const rel of FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.error(`FAIL  ${rel} is missing; this check names it explicitly.`);
    bad += 1;
    continue;
  }
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // "28 categories", "one of 29 categories". Not "(28)", which is a
    // character count, and not "28 selectable" in the accuracy table.
    const re = /\b(\d+)\s+categor(?:y|ies)\b/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      found += 1;
      const stated = Number(m[1]);
      if (stated !== expected) {
        console.error(`FAIL  ${rel}:${i + 1} says "${m[0]}"; the code has ${expected}`);
        console.error(`      ${line.trim()}`);
        bad += 1;
      }
    }
  });
}

if (!found) {
  console.error('FAIL  No category count found in the listing copy at all.');
  console.error('      Either the copy stopped stating one, or the wording moved.');
  process.exit(1);
}
if (bad) {
  console.error(`\n${bad} stale category count${bad === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log(`PASS  ${found} category count${found === 1 ? '' : 's'} in the listing copy, all ${expected}`);
