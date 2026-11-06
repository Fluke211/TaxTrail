/*
 * How does each built slide's caption actually break into lines?
 *
 * Written because eyeballing a 1179x2556 PNG does not show this. Slide 1 went
 * out with "Photograph a receipt. / Your phone / reads it." and the orphan was
 * only found when Tyler said the header looked awkward. Fixing it by widening
 * the shared `.sub` box then moved the problem onto slides 4 and 6 without
 * touching slide 1, and the third defect it turned up (slide 3's headline
 * ending in a lone "lines.") had been shipping since the slide was written.
 *
 * None of those three were visible to me. All three were obvious in one table
 * of words-per-line, so this prints that table.
 *
 * An ORPHAN is a last line holding a single word under a multi-word line. That
 * is the thing that reads as a mistake, and it is what this exits nonzero on.
 * Two words is left alone: it is a judgement call and usually fine.
 *
 * Needs the same headless Chromium `build.js` uses and no npm dependency, for
 * the same reason: the app's package.json is pinned and checked.
 *
 *   node tools/screenshots/build.js        # must run first; this reads out/*.html
 *   node tools/screenshots/measure-lines.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, 'out');
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium';

/* Wrap every word in a span, group the spans by their rendered top offset, and
   report each group. The browser does the line breaking; this only reads it
   back, which is the whole point -- a rule reimplemented here could be wrong
   in exactly the way the CSS is. */
const PROBE = `<script>
window.addEventListener('load', function () {
  var out = [];
  ['h1', '.sub'].forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) { out.push(sel + '=none'); return; }
    // Keep <br> intact: a hard break is part of the caption, not whitespace.
    var words = el.innerHTML.split(/(<br>)|\\s+/).filter(Boolean);
    el.innerHTML = words.map(function (w) {
      return w === '<br>' ? '<br>' : '<span class="__w">' + w + '</span>';
    }).join(' ');
    var tops = {};
    el.querySelectorAll('.__w').forEach(function (s) {
      var t = Math.round(s.getBoundingClientRect().top);
      (tops[t] = tops[t] || []).push(s.textContent);
    });
    var lines = Object.keys(tops).sort(function (a, b) { return a - b; })
      .map(function (t) { return tops[t]; });
    out.push(sel + '=' + lines.map(function (l) { return l.length; }).join(',')
      + ' :: ' + lines.map(function (l) { return l.join(' '); }).join(' | '));
  });
  document.title = 'MEASURE ' + out.join(' ;; ');
});
</script>`;

if (!fs.existsSync(CHROME)) {
  console.error('No headless Chromium at ' + CHROME + '. Set CHROME_BIN.');
  process.exit(2);
}
const pages = fs.existsSync(OUT)
  ? fs.readdirSync(OUT).filter((f) => f.endsWith('.html')).sort()
  : [];
if (!pages.length) {
  console.error('No built slides in ' + OUT + '. Run build.js first.');
  process.exit(2);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-lines-'));
const orphans = [];

for (const page of pages) {
  const name = page.replace(/\.html$/, '');
  const probed = path.join(tmp, page);
  fs.writeFileSync(probed, fs.readFileSync(path.join(OUT, page), 'utf8') + PROBE);

  const dom = execFileSync(CHROME, ['--headless', '--no-sandbox', '--disable-gpu',
    '--virtual-time-budget=4000', '--dump-dom', 'file://' + probed],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });

  const found = dom.match(/<title>MEASURE ([^<]*)<\/title>/);
  console.log('\n' + name);
  if (!found) { console.log('  (no measurement)'); continue; }

  for (const part of found[1].split(' ;; ')) {
    console.log('  ' + part);
    const counts = (part.match(/=([\d,]+)/) || [])[1];
    if (!counts) continue;
    const lines = counts.split(',').map(Number);
    if (lines.length > 1 && lines[lines.length - 1] === 1) {
      orphans.push(name + ' ' + part.split(' :: ')[0]);
    }
  }
}

fs.rmSync(tmp, { recursive: true, force: true });

if (orphans.length) {
  console.log('\nFAIL  one word alone on the last line:');
  for (const o of orphans) console.log('  ' + o);
  console.log('\nA sub wraps on its own, so widen it or let `text-wrap: balance`');
  console.log('rebalance it. A caption\'s <br> defeats balance, so fix the COPY.');
  process.exit(1);
}
console.log('\nPASS  ' + pages.length + ' slides, no orphaned last line.');
