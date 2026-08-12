# Changelog

Version-stamp discipline (see `DECISIONS.md` D-008): every deliverable carries a
visible version, and it gets recorded here.

- `APP_BUILD` — bump on every native build
- `JS_REVISION` — bump on every OTA update
- Both live in `mobile/src/lib/version.ts`

---

## iOS app

### v1.0.0 (build 1) · js r11 — 2026-08-12

- **Privacy link now points at `taxtrail.app`**, and so do both App Store URLs.
  Only made after the live site returned 200 five consecutive times per page
  (D-033) — a fresh Cloudflare Pages custom domain serves 522s for the first
  couple of minutes, and acting on the first success would have shipped a
  broken Guideline 3.1.2 link for the second time.

### v1.0.0 (build 1) · js r10 — 2026-08-10

- **Fixed a broken privacy link in the paywall.** The repo rename to `TaxTrail`
  moved the GitHub Pages path, so `FallbackPaywall`'s `PRIVACY_URL` was pointing
  at a URL that now returns 404 — verified. Guideline 3.1.2 requires a working
  privacy link on the purchase screen, so this would have failed review.
- Support and privacy pages carry a real contact address, `taxtrail@vaultvision.team`
  (D-027). Submission is no longer blocked on it.
- Expo `slug` stays `receiptsnap` (D-028). Renaming the project on expo.dev
  changed its display name only; two controlled `usage` runs showed the flip
  breaks `eas build:list`. Developer-facing plumbing, invisible to users.

### v1.0.0 (build 1) · js r9 — 2026-08-10

**Renamed from ReceiptSnap to TaxTrail** (D-026). Not yet published — ships
after PR merge.

- App name, version stamp, paywall copy and every export filename now read
  **TaxTrail**: `taxtrail-2026.csv`, `taxtrail-archive-<stamp>.zip`,
  `taxtrail-diagnostics-<date>.json`, and the `app` field in `backup.json`.
- Bundle identifier **`com.tylerthornbrue.taxtrail`** on iOS and Android.
  Permanent once shipped, and nothing has shipped — this was the window.
  **Requires a new provisioning profile and a build.**
- The on-device database filename is deliberately unchanged, so existing
  receipts survive the rename. Same for the App Store Connect product IDs.

### v1.0.0 (build 1) · js r7 — 2026-08-07

Shipped over the air; no new build.

- **Sales tax parsed correctly on two real-world layouts** (D-020). Bass Pro's
  `$13.98 @ 6.0%` was read as the tax rather than the taxable base; Safeway's
  column layout put an item price next to the `TAX` label. Adds a plausibility
  bound (tax ≤ 25% of total), computes `$X @ Y%` properly, and scans ahead when
  the adjacent amount is implausible.
- **The update-check button is hidden outside dev/preview channels** (D-019), so
  it cannot reach the App Store — a guard rather than a reminder.
- Corpus grown to five receipts from the first diagnostics export.

### v1.0.0 (build 1) · js r6 — 2026-08-06

Shipped over the air; no new build.

- **"Tap to check for updates"** under the version stamp in Summary. A dev
  client pins whichever update was launched from its launcher and does not poll
  the channel, so picking up a new JS revision otherwise means shake -> dev menu
  -> Go home -> select the newest build. This fetches and reloads in one tap.
  Harmless in a production build, where it just forces an early check.

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

### 2026-08-12

- **`taxtrail.app` is live** — Cloudflare Pages serving `site/`, email routing
  with a catch-all, full DNS. D-033 records the three non-obvious parts:
  attaching a Pages custom domain does not create the DNS record, the project's
  `pages.dev` subdomain is not its project name, and a fresh domain returns 522
  before it settles
- `cloudflare.yml` gained destination-address creation and apex DNS management

### 2026-08-11

- **`taxtrail.app` email DNS is live** — Email Routing enabled on the zone via
  `cloudflare.yml step: email`; MX, SPF and DKIM records confirmed in public DNS
- Cloudflare token preflight rewritten to verify by capability rather than
  against `/user/tokens/verify`, which is user-scoped and always 401s for an
  account-owned token (D-032). A length assertion written from memory was
  removed — it had reported a valid token as malformed
- `status` now prints each endpoint's HTTP code instead of swallowing errors,
  which is what identified the token as zone-scoped

### 2026-08-10 (later)

- `.github/workflows/cloudflare.yml` — Cloudflare driver on the EAS pattern
  (D-031): `status` / `email` / `pages` / `verify`. There is no MCP server for
  Cloudflare DNS, Email Routing or Pages, and the API is reachable, so it runs
  from Actions with a scoped token in repository secrets
- `docs/RUNBOOK.md`: rewrote the Cloudflare procedure against what the dashboard
  actually does — enabling routing on the zone is a separate step from adding a
  destination address, and it is the one that writes the DNS records

- `site/` — the public taxtrail.app site: landing page, privacy policy and
  support page, on `support@taxtrail.app` (D-030). Deployed by Cloudflare Pages
  from that subdirectory, which keeps the retired PWA at the repo root out of it
- D-029: hosting split, and why a custom domain must never go on this repo's
  GitHub Pages — it would move the origin and strand the PWA's stored receipts
- D-030: one support address, via Cloudflare Email Routing
- `docs/RUNBOOK.md`: the one-time Cloudflare procedure, with the 200-check that
  must pass before the app's privacy link is repointed

### 2026-08-10

- `docs/NAMING_2026-08.md` — name shortlist with live-verified conflicts,
  a recommendation, and the clearance procedure Tyler runs
- `docs/CROSS_SURFACE_RULES.md` — the account-wide rule block, so the
  verify-before-recommending rule reaches chat and Cowork, not just Claude Code
- D-024: Control Center / launcher shortcuts — URL scheme now, native
  `ControlWidget` deferred to SDK 56
- D-025: where standing rules live across Claude surfaces
- Barcode scanning confirmed already present in build 1 via `expo-camera`;
  the personal-receipts / returns feature added to the roadmap as JS-only

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
