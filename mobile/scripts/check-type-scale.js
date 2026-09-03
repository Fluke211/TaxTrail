#!/usr/bin/env node
/*
 * Font sizes come from the scale, not from whoever wrote that screen.
 *
 * The app reached nine distinct sizes below 15pt (10, 10.5, 11, 11.5, 12, 12.5,
 * 13, 13.5, 14), which is not a design, it is a residue. Tyler asked twice for
 * the small text to be bigger, and the second time meant editing 58 numbers
 * across 10 files (D-080).
 *
 * So the sizes live in `theme.ts` as `T.fs`, and this is what keeps them there.
 * It is the same move as `check-prose.js`: a convention nobody enforces is a
 * convention the next screen forgets.
 *
 *   node scripts/check-type-scale.js
 *
 * WHAT IS ALLOWED: anything at or above HEADING_MIN. Headings, amounts and the
 * brand mark were tuned individually and none of them was ever the complaint.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { sourceFiles } = require('./lib/source-files');

const ROOT = path.join(__dirname, '..');

/* Above this, a literal is a heading and its own business. Below it, the size
 * is body-ish text and belongs to the scale. */
const HEADING_MIN = 17;

/*
 * `index.tsx` is exempt, structurally.
 *
 * The crash screen deliberately imports nothing of the app's, because app code
 * is what just failed (D-074), so it cannot reach `T.fs`. Its sizes are checked
 * by eye and kept in step by hand.
 */
const EXEMPT_FILES = new Set(['index.tsx']);

function stripComments(src) {
  // Enough for this job: literals only appear in style objects, and no comment
  // in the tree contains `fontSize:`.
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
}

const findings = [];
let fromScale = 0;
let headings = 0;

for (const file of sourceFiles(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (EXEMPT_FILES.has(rel)) continue;
  stripComments(fs.readFileSync(file, 'utf8')).split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/fontSize: ([A-Za-z0-9_.]+)/g)) {
      const value = m[1];
      if (value.startsWith('T.fs.')) { fromScale++; continue; }
      const n = Number(value);
      if (Number.isNaN(n)) continue;           // a variable, e.g. Icon's `size`
      if (n >= HEADING_MIN) { headings++; continue; }
      findings.push({ rel, line: i + 1, value, text: line.trim().slice(0, 100) });
    }
  });
}

/* The scale has to stay ordered, or the names stop meaning anything. */
const theme = fs.readFileSync(path.join(ROOT, 'src/lib/theme.ts'), 'utf8');
const scale = {};
const block = /const TYPE = Object\.freeze\(\{([^}]*)\}/.exec(theme);
if (!block) {
  console.log('  ::error::the TYPE scale could not be found in src/lib/theme.ts');
  process.exit(1);
}
for (const m of block[1].matchAll(/(\w+):\s*([0-9.]+)/g)) scale[m[1]] = Number(m[2]);
const ORDER = ['xs', 'sm', 'md', 'body', 'lg'];
for (let i = 1; i < ORDER.length; i++) {
  const lo = scale[ORDER[i - 1]];
  const hi = scale[ORDER[i]];
  if (!(hi > lo)) {
    findings.push({
      rel: 'src/lib/theme.ts', line: 0, value: `${ORDER[i]}=${hi}`,
      text: `${ORDER[i]} (${hi}) is not larger than ${ORDER[i - 1]} (${lo})`,
    });
  }
}

if (!findings.length) {
  console.log(`${fromScale} font sizes from the scale, ${headings} headings at ${HEADING_MIN}pt or above.`);
  console.log(`Scale: ${ORDER.map((k) => `${k} ${scale[k]}`).join(', ')}.`);
  process.exit(0);
}

console.log('');
for (const f of findings) {
  console.log(`  ${f.rel}${f.line ? ':' + f.line : ''}`);
  console.log(`    ${f.text}`);
  console.log(`  ::error file=${f.rel},line=${f.line || 1}::fontSize ${f.value} is a literal below ${HEADING_MIN}pt. Use T.fs (xs/sm/md/body/lg) so the next "make it bigger" is one number: see D-080.`);
}
console.log('');
console.log(`${findings.length} font size${findings.length === 1 ? '' : 's'} outside the scale.`);
console.log('Pick the rung that matches the role rather than adding a new number.');
process.exit(1);
