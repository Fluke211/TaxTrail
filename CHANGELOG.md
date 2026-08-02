# Changelog

Version-stamp discipline (see `DECISIONS.md` D-008): every deliverable carries a
visible version, and it gets recorded here.

- `APP_BUILD` — bump on every native build
- `JS_REVISION` — bump on every OTA update
- Both live in `mobile/src/lib/version.ts`

---

## iOS app

### v1.0.0 (build 1) · js r1 — unreleased

First development client. Not yet successfully built — the initial attempt
failed on code signing (see `STATUS.md`).

Contents at time of first build attempt:

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
- Native modules added ahead of the build: document scanner (VisionKit), camera,
  notifications, local authentication, print, haptics, location
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
