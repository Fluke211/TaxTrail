# App Store screenshots

Six images at exactly the pixel size Apple accepts, composed from raw captures
taken on the phone.

## Why this exists

An iPhone 14 captures at **1170x2532**, which is not an accepted upload size,
so raw grabs cannot be uploaded as they are.

**Read the accepted size off the tab in App Store Connect, not off a guide or
off this file.** Screenshots are organised by device class there, and each tab
states the sizes it takes. That has already changed once under this script:
it was written for the 6.9-inch sizes (1290x2796, 1320x2868, 1260x2736), those
are now refused, and the iPhone tab asks for **1179x2556** or **1206x2622**.
Six uploads failed at once before anybody noticed this note had gone stale.

Changing it is two constants, `OUT_W` and `OUT_H` in `build.js`. The
composition is still laid out at 1290x2796, because every pixel value in it is
tuned for that, and the whole stage is scaled to the output canvas instead.
Pick the target whose aspect ratio is closest to 1290x2796 (1179x2556 is within
0.02%) so the scale stays a clean resize.

The usual answer is "run the simulator on a Mac". Tyler does not have reliable
access to one, and he does not need one: App Store screenshots are designed
graphics, not raw captures. A caption, a frame, the app inside it. This composes
them with the headless Chromium already installed on the agent machine, with no
npm dependency, because the app's `package.json` is pinned and checked.

## How to use it

1. Take the six captures on the phone. Screenshot as normal; any aspect works,
   the image is drawn to fill the frame from the top.
2. Drop them in `captures/` with the names in `slots.json`.
3. `node tools/screenshots/build.js`
4. Upload `out/*.png` from App Store Connect. The uploader works in mobile
   Safari, so this does not need a computer either.

Build one slot at a time with `node tools/screenshots/build.js 2-privacy`.

Every render is checked to be exactly 1290x2796 before it is reported as done.
A wrong size is rejected at upload, and that rejection arrives long after anyone
remembers why.

## The six slots

Order matters more than polish. People swipe two or three and stop.

| | what it shows |
|---|---|
| 1 | Capture, and the parsed result. The core loop in one image |
| 2 | The privacy claim, over the app |
| 3 | Categories, with real IRS line numbers |
| 4 | Summary by Schedule C line |
| 5 | The export sheet |
| 6 | A split receipt, with tax divided |

## What slot 2 is allowed to say

The canon said for weeks that slot 2 is a privacy-label comparison naming
Keeper, QuickBooks and Wave, and that the contrast is the whole pitch. The
contrast survives here; the names do not. Two guidelines, read rather than
remembered:

- **2.3.3** "Screenshots should show the app in use, and not merely the title
  art, login page, or splash screen. They may also include text and image
  overlays." A slot that is only a comparison table is not the app in use.
- **2.3.7** "don't try to pack any of your metadata with trademarked terms,
  popular app names ..." Three competitors' marks in a screenshot is a
  reviewer's discretion at best, and it invites a complaint from the mark
  holders that has nothing to do with Apple.

There is a third reason that is not about rules. A claim about someone else's
privacy label is only true until they change it, and they can change it without
telling anyone. Every line in slot 2 is a claim about **this** app, which is
verifiable, which Apple's own label already backs, and which stays true.

The card sits over the middle of the frame rather than filling it, so the app is
visible above and below the claims. That is deliberate: it is what keeps this a
screenshot of the app in use.

## Rebuilding after a design change

The composition reads the app's palette from constants at the top of
`build.js`, copied out of `src/lib/theme.ts` rather than imported, because that
file is TypeScript and this is a standalone script. If the palette moves, move
these too.
