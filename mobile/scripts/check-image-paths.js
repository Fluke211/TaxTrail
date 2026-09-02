#!/usr/bin/env node
/*
 * A stored image path must never be handed straight to a consumer.
 *
 * The database holds `receipts/x.jpg`. Opening it needs the absolute path for
 * THIS launch, which `resolveImage()` builds (D-075). Skip that and nothing
 * throws: `<Image>` renders blank, `getInfoAsync` reports the file missing, and
 * `deleteAsync` reports success while the photograph stays on the device.
 *
 * Both forms are `string`, so TypeScript cannot tell them apart. This can, for
 * the case that actually happened: review found that FeedbackComposer had been
 * left behind by the migration, so every scan-problem report would have arrived
 * with no pictures while telling the user it attached them.
 *
 * WHAT IT CATCHES: a sink called with `.imagePath` / `.thumbPath` on the same
 * line, without `resolveImage` on that line.
 *
 * WHAT IT DOES NOT: a stored path assigned to a variable and used later. That
 * is the normal, correct shape in this codebase — `const uri =
 * resolveImage(r.imagePath)` and then `uri` — so a check that chased variables
 * would mostly flag correct code. This is a guard against the one-liner, not a
 * proof.
 *
 *   node scripts/check-image-paths.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { sourceFiles } = require('./lib/source-files');

const ROOT = path.join(__dirname, '..');

/** Anything that opens, reads, writes, deletes or displays a file. */
const SINKS = [
  'uri:', 'uri=', 'source=',
  'getInfoAsync', 'readAsStringAsync', 'writeAsStringAsync',
  'deleteAsync', 'copyAsync', 'moveAsync',
  'attachments.push',
];

const FIELD = /\.(imagePath|thumbPath)\b/;


const findings = [];
let checked = 0;

for (const file of sourceFiles(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (!FIELD.test(line)) return;
    const sink = SINKS.find((sk) => line.includes(sk));
    if (!sink) return;
    checked++;
    if (line.includes('resolveImage')) return;
    findings.push({ rel, line: i + 1, sink, text: line.trim().slice(0, 110) });
  });
}

if (!findings.length) {
  // Says what it looked at, not what it proved. Every other consumer resolves
  // into a variable first, which is the correct shape and invisible here.
  console.log(`${checked} one-line image-path use${checked === 1 ? '' : 's'} checked; all resolved.`);
  process.exit(0);
}

console.log('');
for (const f of findings) {
  console.log(`  ${f.rel}:${f.line}  (${f.sink})`);
  console.log(`    ${f.text}`);
  console.log(`  ::error file=${f.rel},line=${f.line}::A stored image path (receipts/x.jpg) is passed to ${f.sink} without resolveImage(). It will silently do nothing: see D-075.`);
}
console.log('');
console.log(`${findings.length} unresolved image path${findings.length === 1 ? '' : 's'}.`);
console.log('Wrap it in resolveImage() from src/lib/images.ts, and branch on the result:');
console.log('a path this launch cannot open should show the placeholder, not a blank.');
process.exit(1);
