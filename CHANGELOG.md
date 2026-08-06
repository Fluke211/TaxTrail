# Changelog

Version-stamp discipline (see `DECISIONS.md` D-008): every deliverable carries a
visible version, and it gets recorded here.

- `APP_BUILD` — bump on every native build
- `JS_REVISION` — bump on every OTA update
- Both live in `mobile/src/lib/version.ts`

---

## iOS app

### v1.0.0 (build 1) · js r5 — 2026-08-06

Shipped over the air; no new build.

- **Fixed the category picker overflowing the screen.** All 29 categories
  rendered inline and painted over the notes field and the Save/Discard
  buttons — `maxHeight` on a React Native `View` neither clips nor scrolls
  (D-017). Now a full-screen modal with a scrollable list, the current
  selection marked, and the Schedule C line shown per option.
- Same fix applied to the split-category and saved-receipt-edit pickers, which
  had the same bug; the receipt-edit one had no height bound at all.

### v1.0.0 (build 1) · js r4 — 2026-08-06

Shipped over the air; no new build.

- **Pinch-zoom on receipt photos**, in both the capture review and the saved
  receipt detail. Checking a parse means reading the line items, which a 170px
  thumbnail can't support. Uses iOS ScrollView's native zoom — no new native
  dependency.
- **Parser diagnostics export** — raw Apple Vision output beside what the
  classifier made of it, so a scanning session becomes fixtures in bulk.
- **Classifier scoring harness** (`npm run test:score`) over
  `__tests__/corpus/`. Triage mode needs no expected values; `.expected.json`
  files add hard assertions. Seeded with the three existing fixtures.

### v1.0.0 (build 1) · js r3 — 2026-08-06

Shipped over the air; no new build.

- **VisionKit document scanning** on the camera path. Edge detection,
  perspective correction and contrast enhancement now happen before Apple
  Vision sees the image — the image was always the bottleneck, not the
  recognizer. Falls back to the plain camera if the scanner fails.
- **Multi-page capture**, so long receipts that don't fit one frame parse as a
  single blob. The first page is stored and displayed.
- **Receipt archive export** (`.zip`: images, CSV, backup.json, README) so the
  photographs can leave the device — the prerequisite for treating the app as
  a record of receipts you've thrown away (D-016).
- Decision IDs deduplicated after two sessions collided on D-012/D-013.

### v1.0.0 (build 1) · js r1 — 2026-08-02

First development client. Built and installable.

- Build ID `c0d5ebc3-8439-4333-aaa0-503feab787d2`
- Profile `development` — dev client, ad-hoc internal distribution
- Provisioned to iPhone `00008110-000969302ED3A01E`

An earlier attempt errored at code signing: `expo-notifications` injects the
`aps-environment` entitlement and the provisioning profile predated that module
(D-011). The module was removed and the rebuild succeeded.

Contents:

- Expo SDK 55, RN 0.83, New Architecture, TypeScript, min iOS 15.1
- On-device OCR via `expo-text-extractor` (Apple Vision)
- `classifier.js` and `exporters.js` extracted from PWA v5.5, including the
  Costco FSA and OCR-decimal fixes
- Storage: expo-sqlite; images as JPEGs under documentDirectory
- Merchant and city tax-rate memory via AsyncStorage, Dice-similarity
  fingerprints with a street-number digit gate
- Exports: CSV, XLSX (SheetJS), TXF, QuickBooks CSV
- Custom 3-tab shell, no navigation library
- Bundle ID `com.tylerthornbrue.receiptsnap`
- Native modules: document scanner (VisionKit), camera, local authentication,
  print, haptics, location. `expo-notifications` deliberately excluded — it
  requires the push entitlement and is not needed until the Nov-Dec reminders
  work, which lands alongside the production build's fresh credentials.
- `react-native-document-scanner-plugin` confirmed to compile against RN 0.83
- Permissions: camera, Face ID, photo library, when-in-use location

---

## PWA

### v5.5 — live

Current deployed version, served from `index.html` via GitHub Pages. Includes
the Costco FSA fix and the OCR-decimal fix. The app's `classifier.js` and
`exporters.js` are extracted from this build and must stay in sync with it.

No changes made to the PWA in the 2026-08-01/02 sessions.

---

## Repository

### 2026-08-02

- `expo-notifications` dropped; `usage` step added to report real build
  consumption from `eas build:list` (#14)
- Documentation set: `README.md`, `STATUS.md`, `DECISIONS.md`, `ROADMAP.md`,
  `CHANGELOG.md`, `docs/RUNBOOK.md`, PR template
- Native dependencies added and permission surface audited (#12)
- `newArchEnabled` removed — inert under SDK 55, failed schema validation (#11)
- Bundle identifier changed to `com.tylerthornbrue.receiptsnap` (#10)
- Codespace retargeted at the configured `mobile/` project (#9)
- EAS-configured project committed to `mobile/` (#8)
- EAS driver workflow for phone-only operation (#5, fixed in #6 and #7)
- `CLAUDE.md` handoff (#4)
- Installer script, devcontainer, task runner, GTM strategy (#3)
