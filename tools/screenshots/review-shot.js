/*
 * Convert a raw phone screenshot into an App Store Connect accepted size,
 * with nothing added to it.
 *
 * This is NOT build.js. build.js composes a marketing slide with a caption
 * over the app. A subscription's App Review screenshot must do the opposite:
 * Apple asks for "a screenshot of the In-App Purchase that clearly shows the
 * item or service being offered", so the reviewer should see the paywall as a
 * user sees it, with no caption and no frame.
 *
 * It exists because the raw capture is the wrong size. An iPhone 14 screenshots
 * at 1170x2532, which App Store Connect refuses, and Apple's rule for this
 * field is "upload a screenshot that meets any of the screenshot specifications
 * your app supports". So the paywall grab has to be resized exactly like the
 * six marketing slides were, or it is refused for the same reason (D-106).
 *
 * 1170x2532 and 1179x2556 differ in aspect by 0.18%, so this scales to the
 * target WIDTH and pads the few remaining rows rather than stretching: the
 * pixels a reviewer reads are untouched.
 *
 *   node tools/screenshots/review-shot.js <input.png> [output.png]
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT_W = 1179;
const OUT_H = 2556;
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium';

const input = process.argv[2];
const output = process.argv[3]
  || path.join(__dirname, 'out', 'review-' + path.basename(input || 'shot.png').replace(/\.[^.]+$/, '') + '.png');

if (!input) {
  console.error('Usage: node tools/screenshots/review-shot.js <input.png> [output.png]');
  process.exit(2);
}
for (const [what, p] of [['input image', input], ['Chromium', CHROME]]) {
  if (!fs.existsSync(p)) { console.error('No ' + what + ' at ' + p); process.exit(2); }
}

/* PNG and JPEG dimensions, read from the file's own header. */
function dimensions(file) {
  const b = fs.readFileSync(file);
  if (b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  throw new Error('Not a PNG or JPEG: ' + file);
}

const src = dimensions(input);
// Scale to the target width; the height follows, and any shortfall is padded.
const scale = OUT_W / src.w;
const drawnH = Math.round(src.h * scale);
const mime = /\.jpe?g$/i.test(input) ? 'image/jpeg' : 'image/png';
const dataUri = 'data:' + mime + ';base64,' + fs.readFileSync(input).toString('base64');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'review-shot-'));
const page = path.join(tmp, 'page.html');
fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>
  html,body { margin:0; padding:0; background:#000; }
  body { width:${OUT_W}px; height:${OUT_H}px; overflow:hidden; }
  img { display:block; width:${OUT_W}px; height:${drawnH}px; }
</style><img src="${dataUri}">`);

execFileSync(CHROME, ['--headless', '--no-sandbox', '--disable-gpu',
  '--hide-scrollbars', '--force-device-scale-factor=1',
  `--window-size=${OUT_W},${OUT_H}`, '--virtual-time-budget=6000',
  '--screenshot=' + output, 'file://' + page],
  { stdio: ['ignore', 'ignore', 'ignore'] });
fs.rmSync(tmp, { recursive: true, force: true });

const got = dimensions(output);
if (got.w !== OUT_W || got.h !== OUT_H) {
  console.error(`FAIL  wrote ${got.w}x${got.h}, wanted ${OUT_W}x${OUT_H}`);
  process.exit(1);
}
const pad = OUT_H - drawnH;
console.log(`${src.w}x${src.h} -> ${got.w}x${got.h}` + (pad ? `  (${pad}px padded, image not stretched)` : ''));
console.log(output);
