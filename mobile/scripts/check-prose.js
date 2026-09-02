#!/usr/bin/env node
/*
 * No em or en dashes in anything the user reads.
 *
 * Tyler's rule, 2026-09-02: an em dash may appear in a list or a label, never
 * in a normal sentence. He noticed two of them on the capture screen and does
 * not want to see them anywhere in the app.
 *
 * That is a wording preference, which is precisely the kind of rule that decays
 * — the next screen written from memory reintroduces it, and nobody notices
 * until he does. So it is a check rather than a note in CLAUDE.md.
 *
 * The en dash is flagged too. It is not what he objected to, but it is what an
 * em dash turns into when somebody "fixes" one by halving it, and this app has
 * no numeric ranges for it to be legitimately doing.
 *
 * WHAT IS SCANNED: source under `src/` plus the entry point, and the string
 * VALUES in `app.json` — the permission prompts there are shown verbatim in an
 * iOS system alert, which is as user-facing as text gets. Comments are exempt
 * on purpose: they are written for whoever maintains this, not for the user,
 * and this file is full of them.
 *
 *   node scripts/check-prose.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { sourceFiles } = require('./lib/source-files');

const ROOT = path.join(__dirname, '..');
const DASHES = /[\u2014\u2013]/;   // em dash, en dash

/*
 * The two exemptions, both structural rather than a list of sentences somebody
 * decided to keep.
 *
 * `scheduleC` labels are the IRS's own line names in a data table — "Line 24a
 * — Travel" — which is the label case the rule explicitly allows. They are also
 * copied into every exported CSV, XLSX and TXF and stored on every receipt row,
 * so rewording them is a data migration, not a copy edit.
 *
 * exporters.js's `ascii()` contains the dash characters because its job is to
 * strip them out of CSV output.
 */
const EXEMPT = [
  {
    file: 'src/lib/classifier.js',
    test: (line) => /scheduleC:/.test(line),
    why: 'IRS Schedule C line labels (a data table, and they flow into exports)',
  },
  {
    file: 'src/lib/exporters.js',
    // The character class itself, not "any line that calls .replace(" — that
    // exempted an unrelated CSV-quoting line, and would have exempted a future
    // export header that happened to sit on one.
    test: (line) => /\[\\u2014\\u2013\]|\[\u2014\u2013\]/.test(line),
    why: 'ascii() strips these characters, so it has to name them',
  },
];

/*
 * Blank out comments, keeping every other character in place.
 *
 * A regex cannot do this. The first attempt used one and was wrong in both
 * directions: `/*` inside a string literal blanked hundreds of real lines, and
 * a back-stop bolted on to catch that flagged every continuation line of every
 * JSX comment in the app. So this is a character scanner instead. It is small
 * because it only has to know five states, and it is exact because it does not
 * guess what a line "looks like".
 *
 * Comment characters become spaces rather than disappearing, so line and column
 * numbers still point at the real file.
 */
function lineEnd(src, from) {
  const at = src.indexOf('\n', from);
  return at === -1 ? src.length : at;
}

/** Index of the closing quote, or -1 if it does not close before `limit`. */
function findClose(src, open, quote, limit) {
  let i = open + 1;
  while (i < limit) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === quote) return i;
    i++;
  }
  return -1;
}

function stripComments(src) {
  const out = src.split('');
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };

  /*
   * `/` is ambiguous in JavaScript: division or the start of a regex. Getting
   * it wrong matters here because classifier.js is full of patterns like
   * `/don't/`, and reading that apostrophe as the start of a string throws the
   * scanner out of step for the rest of the file — which it did, and every
   * comment after it was reported as user-facing text.
   *
   * The standard heuristic: a regex can only begin where a value can begin.
   */
  const REGEX_OK_AFTER = '(,=:[!&|?{};+-*%~^<>';
  // A regex can also follow a keyword. `return /[",\n]/.test(cell)` in
  // exporters.js is the real line that made this necessary: read as division,
  // the `"` inside the pattern opened a string and every comment after it was
  // reported as user-facing text.
  const REGEX_OK_KEYWORDS = new Set([
    'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
    'case', 'do', 'else', 'yield', 'await',
  ]);
  const afterKeyword = (at) => {
    const before = src.slice(Math.max(0, at - 20), at);
    const m = /([A-Za-z_$][\w$]*)\s*$/.exec(before);
    return m ? REGEX_OK_KEYWORDS.has(m[1]) : false;
  };
  let lastSignificant = '';

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '/' && next === '/') {
      let end = src.indexOf('\n', i);
      if (end === -1) end = src.length;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === '/' && next === '*') {
      let end = src.indexOf('*/', i + 2);
      end = end === -1 ? src.length : end + 2;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      /*
       * A quote only opens a string if it CLOSES on the same line.
       *
       * `<Text>Don't stop</Text>` is JSX text, not a literal, and reading that
       * apostrophe as an opening quote swallowed everything up to the next one
       * anywhere in the file — which desynced the scanner and made it report
       * maintainer comments as user-facing prose. A template literal is the one
       * kind that legitimately spans lines, so only backticks may.
       */
      const closes = c === '`'
        ? findClose(src, i, c, src.length)
        : findClose(src, i, c, lineEnd(src, i));
      if (closes === -1) { lastSignificant = c; i++; continue; }
      i = closes + 1;
      lastSignificant = c;
      continue;
    }
    if (c === '/' && (lastSignificant === '' || REGEX_OK_AFTER.includes(lastSignificant) || afterKeyword(i))) {
      i++;
      let inClass = false;
      while (i < src.length && src[i] !== '\n') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { i++; break; }
        i++;
      }
      lastSignificant = '/';
      continue;
    }
    if (!/\s/.test(c)) lastSignificant = c;
    i++;
  }
  return out.join('');
}


const findings = [];
let exempted = 0;

for (const file of sourceFiles(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const raw = fs.readFileSync(file, 'utf8');
  const lines = stripComments(raw).split('\n');
  const rawLines = raw.split('\n');
  const exemptions = EXEMPT.filter((e) => e.file === rel);
  lines.forEach((line, i) => {
    if (!DASHES.test(line)) return;
    if (exemptions.some((e) => e.test(rawLines[i] || line))) { exempted++; return; }
    findings.push({ rel, line: i + 1, text: (rawLines[i] || line).trim().slice(0, 100) });
  });
}

/*
 * app.json's string values. The iOS usage descriptions in here are read aloud
 * by the system permission alert, and the App Store fields are read by everyone
 * who looks at the listing. Keys are skipped; only values can be prose.
 */
(function scanAppJson() {
  const rel = 'app.json';
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // A malformed app.json is a real problem and someone else's to report. This
    // check saying so with a raw stack trace would just blame the wrong thing.
    console.log(`  note: app.json could not be parsed, so it was not scanned (${e.message})`);
    return;
  }
  const walk = (node, trail, key) => {
    if (typeof node === 'string') {
      if (!DASHES.test(node)) return;
      // Located by KEY, not by value: a value containing an escape sequence or
      // wrapped across lines never matches the raw source, and the finding then
      // points at line 1.
      const at = lines.findIndex((l) => l.includes(`"${key}"`));
      findings.push({ rel, line: at === -1 ? 1 : at + 1, text: `${trail}: ${node.slice(0, 80)}` });
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) walk(v, trail ? `${trail}.${k}` : k, k);
    }
  };
  walk(parsed, '', '');
})();

/*
 * The App Store listing's copy blocks.
 *
 * `docs/APP_STORE_LISTING.md` is the most-read prose the project produces: its
 * fenced blocks are pasted verbatim into App Store Connect. The prose around
 * them is working notes, which is why only the fences are scanned — the same
 * distinction as source and comments.
 *
 * A list item inside a fence keeps its dash. That is the case Tyler's rule
 * explicitly allows, and the App Review notes use it.
 */
(function scanListing() {
  const rel = 'docs/APP_STORE_LISTING.md';
  const file = path.join(ROOT, '..', rel);
  if (!fs.existsSync(file)) return;
  let inFence = false;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.trim().startsWith('```')) { inFence = !inFence; return; }
    if (!inFence || !DASHES.test(line)) return;
    if (/^\s*[-*]\s/.test(line)) { exempted++; return; }   // a list, which is allowed
    findings.push({ rel, line: i + 1, text: line.trim().slice(0, 100) });
  });
})();

if (!findings.length) {
  console.log('No em or en dashes in user-facing text.');
  if (exempted) {
    console.log(`${exempted} exempt line${exempted === 1 ? '' : 's'}:`);
    // `·`, not the character this script exists to remove. Tyler reads CI logs.
    for (const e of EXEMPT) console.log(`  ${e.file} · ${e.why}`);
    console.log('  docs/APP_STORE_LISTING.md · list items inside a copy block');
  }
  process.exit(0);
}

console.log('');
for (const f of findings) {
  console.log(`  ${f.rel}:${f.line}`);
  console.log(`    ${f.text}`);
  console.log(`  ::error file=${f.rel},line=${f.line}::An em or en dash in user-facing text. Use a full stop, a comma, or "·" between a label and a value.`);
}
console.log('');
console.log(`${findings.length} dash${findings.length === 1 ? '' : 'es'} in text the user reads.`);
console.log('Rewrite the sentence rather than adding an exemption. Exemptions here are');
console.log('for structural cases (a data table, a function that strips the character),');
console.log('never for a sentence somebody would rather keep.');
process.exit(1);
