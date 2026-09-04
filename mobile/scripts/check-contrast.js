#!/usr/bin/env node
/*
 * Is every text colour in each palette actually readable on the ground it sits on?
 *
 * A light theme is where colour choices stop being taste and start being a bug:
 * `#4f7cff` is fine on near-black and marginal on white, and `#fff` title text
 * on a `#f6f7f9` background is simply invisible — which is exactly what the
 * fallback paywall shipped with until this ran.
 *
 * WCAG 2.1 contrast ratios, computed from the palette itself, so a future
 * colour tweak cannot quietly make something unreadable. Body text is held to
 * AA (4.5:1); large/secondary text and non-text borders to 3:1, which is the
 * standard's own threshold for those.
 *
 *   node scripts/check-contrast.js
 */
'use strict';

const path = require('path');
const fs = require('fs');

/*
 * The crash screen carries its own palette.
 *
 * `index.tsx` deliberately does not import `src/lib/theme.ts` — the theme is app
 * code, and app code is what just failed — so it hardcodes four colours per
 * scheme. Review caught that this put them outside the one script that checks
 * such things, with their ratios asserted in a comment instead. Parsed here so
 * the assertion is a check.
 */
function readCrashPalette() {
  const src = fs.readFileSync(path.join(__dirname, '../index.tsx'), 'utf8');
  const start = src.indexOf('const PALETTE = {');
  if (start === -1) throw new Error('PALETTE literal not found in index.tsx');
  const body = src.slice(start, src.indexOf('};', start));
  const out = {};
  for (const m of body.matchAll(/^\s*(dark|light):\s*\{([^}]*)\}/gm)) {
    const p = {};
    for (const t of m[2].matchAll(/([a-zA-Z0-9]+):\s*'([^']+)'/g)) p[t[1]] = t[2];
    out[`CRASH SCREEN (${m[1]})`] = p;
  }
  if (Object.keys(out).length !== 2) throw new Error('expected a dark and a light crash palette');
  return out;
}

/** Pull the two palette literals out of theme.ts without needing a TS runtime. */
function readPalettes() {
  const src = fs.readFileSync(path.join(__dirname, '../src/lib/theme.ts'), 'utf8');
  const out = {};
  for (const name of ['DARK', 'LIGHT']) {
    const start = src.indexOf(`export const ${name}: Palette = {`);
    if (start === -1) throw new Error(`${name} palette not found in theme.ts`);
    const end = src.indexOf('};', start);
    const body = src.slice(start, end);
    const p = {};
    for (const m of body.matchAll(/^\s*([a-zA-Z0-9]+):\s*'([^']+)'/gm)) p[m[1]] = m[2];
    out[name] = p;
  }
  return out;
}

/** #rgb, #rrggbb, or rgba(r,g,b,a) -> {r,g,b,a} in 0-255 / 0-1. */
function parseColor(c) {
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) {
    const [r, g, b] = m[1].split('').map((h) => parseInt(h + h, 16));
    return { r, g, b, a: 1 };
  }
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }
  throw new Error(`cannot parse colour: ${c}`);
}

/** Flatten a translucent colour onto its background — alpha changes contrast,
 *  and every `line`/`accentSoft` token in this palette has some. */
function over(fg, bg) {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fgRaw, bgRaw) {
  const bg = parseColor(bgRaw);
  const fg = over(parseColor(fgRaw), bg);
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/*
 * Every pairing the app actually renders. Each row is
 * [foreground token, background token, minimum ratio, what it is].
 *
 * 4.5 for anything a user reads as body text; 3.0 for large text, secondary
 * labels and non-text boundaries, which is WCAG's own threshold for those.
 */
const PAIRS = [
  ['text', 'bg', 4.5, 'body text on the app background'],
  ['text', 'card', 4.5, 'body text on a card'],
  ['text', 'card2', 4.5, 'body text on an inset control'],
  ['text', 'bg2', 4.5, 'body text on the tab bar'],
  ['muted', 'bg', 4.5, 'secondary text on the app background'],
  ['muted', 'card', 4.5, 'secondary text on a card'],
  // The tab labels. The most persistently visible text in the app, and it had
  // no row here until the type scale changed its size and review noticed.
  ['muted2', 'bg2', 4.5, 'inactive tab labels'],
  ['accent', 'bg', 4.5, 'links and every tappable label'],
  ['accent', 'card', 4.5, 'links on a card'],
  ['accent', 'card2', 4.5, 'links on an inset control'],
  ['danger', 'card', 4.5, 'the Delete label in the danger zone'],
  ['good', 'card', 3.0, 'the business total'],
  ['warn', 'card', 3.0, 'warnings'],
  /*
   * Hint text, at AA rather than the 3:1 tier it used to sit in.
   *
   * That tier is WCAG's threshold for text at 18pt, or 14pt bold, and for
   * non-text. `muted2` renders at 12 and 13 points, so the bar is 4.5 and
   * calling it "secondary" did not change that. Both palettes clear it now
   * (D-080).
   */
  ['muted2', 'bg', 4.5, 'hint text'],
  ['muted2', 'card', 4.5, 'hint text on a card'],
  ['muted2', 'card2', 4.5, 'hint text on an inset control'],
  // Non-text: borders have to be visible or every card loses its edge.
  ['line', 'card', 1.2, 'card borders'],
  ['line', 'bg', 1.2, 'borders on the background'],
  ['dangerLine', 'card', 1.2, 'the danger-zone border'],
];

/*
 * Pairings that owe nothing to the palette, and would otherwise be invisible
 * here: every other row is token-against-token, so text on a hardcoded ground
 * is never measured. That is exactly how darkening the light greys for AA
 * (D-080) took the full-screen zoom hint from 5.96:1 to 4.07:1 without a single
 * check going red.
 */
const FIXED = [
  ['#b3bcca', '#000000', 4.5, 'the zoom hint on the photo backdrop'],
];

// White-on-accent is a fixed pairing: the primary button and the delete action
// both put #fff on a solid colour.
const ON_SOLID = [
  ['#ffffff', 'accent', 4.5, 'button text on the accent colour'],
  ['#ffffff', 'danger', 4.5, 'Delete text on the danger colour'],
];

/*
 * Committed baseline — a ratchet, exactly like the synthetic parser corpus
 * (D-041): a palette that gets WORSE fails, one that is merely imperfect does
 * not.
 *
 * This exists because the check found four pairings in the DARK palette that
 * are below the WCAG target and have shipped that way for months. They are
 * Tyler's brand colours and a real design decision, not a bug introduced here —
 * quietly restyling the app to make a new script pass would be the wrong way
 * round. They are listed below with what they currently measure, and reported
 * every run so they stay visible rather than becoming invisible.
 *
 * The LIGHT palette is new, so it carries no baseline: it has to meet the
 * targets outright, and it does.
 */
const BASELINE = {
  DARK: {
    'accent on card2': 4.26,    // #4f7cff on #182333 — target 4.5
    'line on bg': 1.17,         // a hairline on the darkest ground
    '#fff on accent': 3.71,     // the primary button — clears WCAG's 3:1 large-text bar
    '#fff on danger': 2.78,     // the Delete action
  },
  LIGHT: {},
};

// Floating-point noise, not a regression.
const EPSILON = 0.02;

/* The crash screen renders three things: a title, body copy, and one link-like
 * control. Body text to AA, the rest to the same thresholds as everything else. */
const CRASH_PAIRS = [
  ['text', 'bg', 4.5, 'the crash-screen headline'],
  ['muted', 'bg', 4.5, 'crash-screen body copy'],
  ['accent', 'bg', 4.5, 'Show technical details'],
];

/*
 * The steps between the text tiers, not only each tier against the ground.
 *
 * Brightening secondary text twice (D-078, D-080) moved `muted` and `muted2`
 * closer together each time: 1.96 -> 1.53 -> 1.33. Three ratios measured
 * against the same near-black ground stay ordered no matter how close the
 * colours get, so the evidence used to justify "the hierarchy holds" could not
 * have detected them converging. This can. A third brightening on the same
 * trajectory is what it exists to stop.
 */
const STEPS = [
  ['text', 'muted', 1.3, 'body text against secondary text'],
  ['muted', 'muted2', 1.25, 'secondary text against hint text'],
];

/*
 * Distance is not direction, and this check needs both.
 *
 * `ratio()` is symmetric, so a `muted2` brightened clean past `text` measures a
 * healthy gap and passes, while the error message talks about exactly that
 * case. So each tier must also stand out from the background MORE than the tier
 * below it. That works in both palettes without knowing which way is up: in
 * dark the text is lighter than the ground, in light it is darker, and in each
 * the ordering by contrast-with-ground is the same.
 */
function standsOut(p, token) {
  return ratio(p[token], p.bg);
}

const palettes = { ...readPalettes(), ...readCrashPalette() };
let failures = 0;
let belowTarget = 0;

for (const [name, p] of Object.entries(palettes)) {
  console.log(`\n${name}`);
  const base = BASELINE[name] || {};
  const isCrash = name.startsWith('CRASH SCREEN');
  const rows = isCrash
    ? CRASH_PAIRS.map(([f, b, min, what]) => [p[f], p[b], min, `${f} on ${b}`, what])
    : [
      ...PAIRS.map(([f, b, min, what]) => [p[f], p[b], min, `${f} on ${b}`, what]),
      ...ON_SOLID.map(([f, b, min, what]) => [f, p[b], min, `#fff on ${b}`, what]),
      // FIXED only under the first palette: the pairing owes nothing to either.
      ...(name === 'DARK' ? FIXED.map(([f, b, min, what]) => [f, b, min, `${f} on ${b}`, what]) : []),
    ];
  for (const [fg, bg, min, label, what] of rows) {
    if (!fg || !bg) {
      console.log(`  ::error::${name}: ${label} — a token in this pairing is missing from the palette`);
      failures++;
      continue;
    }
    const r = ratio(fg, bg);
    const allowed = base[label];

    if (allowed !== undefined) {
      // Known-below-target. Fail only if it got worse than what is committed.
      if (r < allowed - EPSILON) {
        failures++;
        console.log(`  FAIL ${label.padEnd(26)} ${r.toFixed(2)}:1  (was ${allowed})  ${what}`);
        console.log(`  ::error::${name}: ${what} REGRESSED to ${r.toFixed(2)}:1 from ${allowed}:1 — ${fg} on ${bg}`);
      } else {
        belowTarget++;
        console.log(`  warn ${label.padEnd(26)} ${r.toFixed(2)}:1  (target ${min}, baselined)  ${what}`);
      }
      continue;
    }

    const ok = r >= min;
    if (!ok) failures++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(26)} ${r.toFixed(2)}:1  (min ${min})  ${what}`);
    if (!ok) console.log(`  ::error::${name}: ${what} is ${r.toFixed(2)}:1, needs ${min}:1 — ${fg} on ${bg}`);
  }
}

for (const [name, p] of Object.entries(palettes)) {
  if (name.startsWith('CRASH SCREEN')) continue;
  console.log(`\n${name} · steps between tiers`);
  for (const [a, b, min, what] of STEPS) {
    if (!p[a] || !p[b]) {
      console.log(`  ::error::${name}: ${a} vs ${b} — a token in this pairing is missing from the palette`);
      failures++;
      continue;
    }
    const r = ratio(p[a], p[b]);
    const ordered = standsOut(p, a) > standsOut(p, b);
    const ok = r >= min && ordered;
    if (!ok) failures++;
    const note = ordered ? '' : '  ORDER INVERTED';
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${`${a} vs ${b}`.padEnd(26)} ${r.toFixed(2)}:1  (min ${min})  ${what}${note}`);
    if (!ordered) {
      console.log(`  ::error::${name}: ${b} stands out from the background more than ${a} does (${standsOut(p, b).toFixed(2)}:1 vs ${standsOut(p, a).toFixed(2)}:1). Brightening one tier past the next stops it being a tier.`);
    } else if (!ok) {
      console.log(`  ::error::${name}: ${what} is only ${r.toFixed(2)}:1 apart. Any closer and the two stop reading as different tiers.`);
    }
  }
}

console.log('');
if (failures) {
  console.log(`${failures} contrast failure${failures === 1 ? '' : 's'}.`);
  console.log('A colour that fails here is unreadable on a real device. Adjust the');
  console.log('palette in src/lib/theme.ts rather than lowering the threshold.');
  process.exit(1);
}
if (belowTarget) {
  console.log(`All pairings hold. ${belowTarget} are below the WCAG target and baselined —`);
  console.log('see BASELINE in this file. They are design decisions to raise with Tyler,');
  console.log('not regressions, and none of them got worse.');
} else {
  console.log('All palette pairings meet their contrast minimum.');
}
