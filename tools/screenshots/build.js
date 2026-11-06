#!/usr/bin/env node
/*
 * App Store screenshots, composed at exactly the size Apple accepts.
 *
 * WHY THIS EXISTS. Tyler's phone is an iPhone 14, which captures at 1170x2532,
 * and that is not an accepted upload size. The usual answer is "use a Mac and
 * the simulator", and he does not have reliable access to one.
 *
 * READ THE SIZE OFF THE TAB, NOT OFF A GUIDE. App Store Connect organises
 * screenshots by device class and states the sizes each tab accepts, and it
 * has already changed once under this script: the 6.9-inch sizes this was
 * built for (1290x2796, 1320x2868, 1260x2736) are now refused, and the iPhone
 * tab asks for 1179x2556 or 1206x2622. Six uploads failed at once before
 * anybody noticed the note here was a year out of date. See OUT_W/OUT_H.
 *
 * He does not need one. App Store screenshots are designed graphics, not raw
 * captures: a caption, a frame, and the app inside it. So he takes raw grabs on
 * the phone, drops them in ./captures, and this composes the six at the exact
 * pixel size, using the headless Chromium that is already on this machine. No
 * npm dependency, because this is tooling and the app's package.json is checked
 * by `npm run test:pins`.
 *
 *   node tools/screenshots/build.js            # all six
 *   node tools/screenshots/build.js 2-privacy  # just one
 *
 * Output lands in ./out as PNG. Upload from mobile Safari; App Store Connect's
 * uploader works there.
 *
 * A NOTE ON WHAT SLOT 2 IS ALLOWED TO SAY. The canon has said for weeks that
 * screenshot 2 is a privacy-label comparison naming Keeper, QuickBooks and
 * Wave. Two guidelines make that a bad idea and both were read rather than
 * remembered (2026-09-06):
 *
 *   2.3.3  "Screenshots should show the app in use, and not merely the title
 *           art, login page, or splash screen. They may also include text and
 *           image overlays." A slot that is only a comparison table is not the
 *           app in use.
 *   2.3.7  "don't try to pack any of your metadata with trademarked terms,
 *           popular app names ..." Three competitors' marks in a screenshot is
 *           at a reviewer's discretion at best, and invites a complaint from
 *           the mark holders that has nothing to do with Apple.
 *
 * So slot 2 keeps the contrast and drops the names. Every line it makes is a
 * verifiable claim about THIS app, which is the strongest ground to stand on
 * and the only ground that stays true when a competitor changes their label.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const OUT = path.join(HERE, 'out');
const CAPTURES = path.join(HERE, 'captures');

/*
 * TWO sizes: the one the composition is designed at, and the one Apple takes.
 *
 * The layout below is tuned in fixed pixels against a 1290x2796 canvas, which
 * was Apple's 6.9-inch size when this was written. App Store Connect has since
 * reorganised its screenshot tabs by device class rather than by inches, and
 * the iPhone tab now states its own accepted sizes: 1179x2556 and 1206x2622.
 * 1290x2796 is refused outright, which is how Tyler found this, six files at
 * a time.
 *
 * So the composition is still built at the size it was tuned for and scaled
 * to the canvas as a whole, rather than re-tuning forty pixel values and
 * re-checking every caption for a new line break. 1179x2556 is the target
 * because its aspect ratio is within 0.02% of the design's, so the scale is
 * effectively a clean resize with no distortion.
 *
 * When Apple moves these again: change OUT_W/OUT_H only. The tab in App Store
 * Connect states the sizes it will take, so read them there rather than from
 * a guide, which is what went stale here.
 */
const DESIGN_W = 1290;
const DESIGN_H = 2796;
const OUT_W = 1179;
const OUT_H = 2556;
const SCALE = OUT_W / DESIGN_W;

/* The app's own palette, so the store page and the app agree. Copied rather
 * than imported: theme.ts is TypeScript and this is a standalone script. */
const T = {
  bg: '#0a0e14',
  bg2: '#121a26',
  accent: '#4f7cff',
  text: '#e8edf5',
  muted: '#b3bcca',
  good: '#35c88a',
};

function chromium() {
  const candidates = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
    process.env.CHROME_PATH,
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(
    'No Chromium found. Set CHROME_PATH, or run this where PLAYWRIGHT_BROWSERS_PATH points at one.',
  );
}

/** A capture as a data URI, or null when it has not been supplied yet. */
function captureUri(name) {
  if (!name) return null;
  const p = path.join(CAPTURES, name);
  if (!fs.existsSync(p)) return null;
  return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
}

/*
 * The frame is a rounded rectangle rather than a photographic device bezel.
 *
 * A drawn bezel has to match a specific phone, and a wrong one reads as
 * careless to exactly the audience who would notice. A plain rounded rect with
 * a hairline reads as deliberate at any size, and it gives the capture more
 * pixels, which is what people actually look at.
 */
function frame(uri, dim) {
  const inner = uri
    ? `<img src="${uri}" alt="">`
    : `<div class="missing">capture missing<br><span>drop a PNG in tools/screenshots/captures</span></div>`;
  return `<div class="frame${dim ? ' dim' : ''}">${inner}</div>`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Newlines in a caption are deliberate line breaks, not accidents. */
function lines(s) {
  return esc(s).split('\n').join('<br>');
}

function html(slot) {
  const uri = captureUri(slot.capture);
  const statement = slot.kind === 'statement';

  const claims = (slot.claims || [])
    .map((c) => `<li>${esc(c)}</li>`)
    .join('');

  return `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  /* The ground goes on html as well as body. Chromium paints the viewport from
   * html, and a body that does not reach the full 2796 leaves a white band at
   * the bottom of the PNG, which is invisible on screen and obvious on a store
   * page. Caught by looking at the render rather than trusting the CSS. */
  html { background: ${T.bg}; }
  /* The output canvas. The composition inside it is a fixed-size stage that
     is scaled to fit, so the ground colour has to be here too: scaling by
     width leaves a sub-pixel sliver at the bottom, and it must not be white. */
  body {
    width: ${OUT_W}px; height: ${OUT_H}px; overflow: hidden;
    background: ${T.bg};
  }
  .stage {
    width: ${DESIGN_W}px; height: ${DESIGN_H}px; overflow: hidden;
    transform: scale(${SCALE}); transform-origin: top left;
    position: relative;
    background: linear-gradient(170deg, ${T.bg2} 0%, ${T.bg} 55%);
    color: ${T.text};
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Inter, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    display: flex; flex-direction: column; align-items: center;
    padding: 132px 90px 0;
  }
  /* A faint accent wash behind the caption, so the top of the image is not a
     flat rectangle at thumbnail size, which is how most people first see it. */
  .stage::before {
    content: ''; position: absolute; top: -340px; left: 50%;
    width: 1500px; height: 900px; transform: translateX(-50%);
    background: radial-gradient(closest-side, rgba(79,124,255,0.22), transparent 70%);
    pointer-events: none;
  }
  h1 {
    position: relative;
    /* Let the browser balance the lines instead of hand-tuning each caption.
       Measured, not assumed: before this, slide 3 read "29 categories, / mapped
       to real IRS / lines." with one word alone on the third line, and four of
       the six sub-lines ended on a single orphan word. Widening the box fixed
       one slide and created orphans on others, because a wider box just moves
       where the bad break lands. */
    text-wrap: balance;
    font-size: 92px; line-height: 1.08; font-weight: 700; letter-spacing: -2.2px;
    text-align: center;
  }
  .sub {
    position: relative;
    margin-top: 30px; font-size: 38px; line-height: 1.35; font-weight: 400;
    /* The full content width, not 1010px. At 1010 the slide-1 sub-line broke
       as "... in about a / second" and left one word alone under a 92px
       headline, which is the same flaw the headline itself had. The stage is
       1290 wide with 90px padding each side, so 1110 is everything there is. */
    color: ${T.muted}; text-align: center; max-width: 1110px;
    text-wrap: balance;
  }
  .frame {
    position: relative;
    margin-top: 62px; width: 900px; height: 1948px; flex: none;
    border-radius: 58px; overflow: hidden;
    background: ${T.bg};
    border: 2px solid rgba(255,255,255,0.13);
    box-shadow: 0 50px 110px rgba(0,0,0,0.55);
  }
  .frame img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
  .frame.dim img { opacity: 0.55; }
  .missing {
    width: 100%; height: 100%; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 18px;
    color: ${T.muted}; font-size: 40px; text-align: center;
    background: repeating-linear-gradient(45deg, #10151d, #10151d 24px, #141b26 24px, #141b26 48px);
  }
  .missing span { font-size: 28px; opacity: 0.75; }
  /*
   * The statement slot: claims sit on a card OVER the app, not directly on it.
   *
   * First attempt put the text straight onto a dimmed screenshot and it was
   * unreadable: receipt rows and amounts ran through every line. A card gives
   * the text its own ground, and covering only the middle of the frame leaves
   * the app visible above and below it, which is what keeps this a screenshot
   * of the app in use (2.3.3) rather than a poster.
   */
  .claims {
    position: absolute; left: 52px; right: 52px; top: 50%;
    transform: translateY(-50%);
    display: flex; flex-direction: column; gap: 40px;
    padding: 62px 56px; list-style: none;
    background: rgba(8, 12, 19, 0.94);
    border: 2px solid rgba(255,255,255,0.10);
    border-radius: 40px;
    box-shadow: 0 34px 80px rgba(0,0,0,0.55);
  }
  .claims li {
    position: relative; padding-left: 76px;
    font-size: 44px; line-height: 1.26; font-weight: 600;
  }
  .claims li::before {
    content: ''; position: absolute; left: 0; top: 8px;
    width: 44px; height: 44px; border-radius: 50%;
    background: ${T.good};
    -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="black"/></svg>') center/34px no-repeat;
            mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="black"/></svg>') center/34px no-repeat;
  }
</style>
<div class="stage">
<h1>${lines(slot.caption)}</h1>
${slot.sub ? `<p class="sub">${esc(slot.sub)}</p>` : ''}
${statement
    ? frame(uri, true).replace('</div>', `<ul class="claims">${claims}</ul></div>`)
    : frame(uri, false)}
</div>
`;
}

function main() {
  const only = process.argv[2];
  const cfg = JSON.parse(fs.readFileSync(path.join(HERE, 'slots.json'), 'utf8'));
  const slots = cfg.slots.filter((s) => !only || s.file === only);
  if (!slots.length) {
    console.log(`No slot named ${only}. Known: ${cfg.slots.map((s) => s.file).join(', ')}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const bin = chromium();
  let missing = 0;

  for (const slot of slots) {
    const page = path.join(OUT, `${slot.file}.html`);
    fs.writeFileSync(page, html(slot));
    const png = path.join(OUT, `${slot.file}.png`);
    execFileSync(bin, [
      '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${OUT_W},${OUT_H}`,
      `--screenshot=${png}`,
      `file://${page}`,
    ], { stdio: ['ignore', 'ignore', 'ignore'] });

    // Trust nothing about the size: an upload at the wrong pixel count is
    // rejected, and the rejection arrives long after anyone remembers why.
    const d = fs.readFileSync(png);
    const w = d.readUInt32BE(16);
    const h = d.readUInt32BE(20);
    if (w !== OUT_W || h !== OUT_H) {
      console.log(`  ::error::${slot.file}.png rendered ${w}x${h}, expected ${OUT_W}x${OUT_H}`);
      process.exit(1);
    }
    const has = captureUri(slot.capture) != null;
    if (!has) missing++;
    console.log(`  ${slot.file}.png  ${w}x${h}  ${has ? 'ok' : 'PLACEHOLDER (no capture yet)'}`);
  }

  console.log('');
  console.log(`${slots.length} screenshot${slots.length === 1 ? '' : 's'} in tools/screenshots/out.`);
  if (missing) {
    console.log(`${missing} still show a placeholder. Put the phone captures in`);
    console.log('tools/screenshots/captures with the names in slots.json and re-run.');
  }
}

main();
