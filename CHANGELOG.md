# Changelog

Version-stamp discipline (see `DECISIONS.md` D-008): every deliverable carries a
visible version, and it gets recorded here.

- `APP_BUILD` — bump on every native build
- `JS_REVISION` — bump on every OTA update
- Both live in `mobile/src/lib/version.ts`

---

## iOS app

### OTA — v1.0.0 (build 3) · js r17 — 2026-08-29

The pre-launch correctness batch. Everything below shipped in this revision.

### Exports — 2026-08-29

Audit of every package-specific export against its spec (D-046). Five real
defects; the one with the most at stake turned out to be already correct.

- **TXF sign convention was already right** — negative for expenses is what
  v042 requires. Verified against four independent copies of the spec
- **Refnum 302 is Record Format 3.** Each "other business expense" category now
  gets its own record with a `P` description and its own `L`, instead of five
  categories merged into one record with their names in an `X` line. `X` is a
  detail-record field with a columnar layout, so the old output put a category
  name where an importer expects a date — and lost the Part V itemization
- **Two categories mapped to the wrong refnum.** Postage → 313 (line 18, per
  "office supplies and postage"), Employee Benefits → 308 (line 14). The
  second meant the exported file contradicted the app's own category label
- **Schedule C "Other expenses" is line 27b, not 27a**, for tax year 2025 — the
  IRS swapped it with the Form 7205 deduction. Four labels were stale
- TXF header date is zero-padded (`D08/01/2026`), and the `A` record now
  carries the app version, as the spec's definition of that field requires
- **QuickBooks CSV no longer starts with a BOM.** It is machine-read by QBO's
  importer, where a BOM can only be read as part of the first header name; the
  CPA CSV keeps its BOM because that one gets opened in Excel
- Renamed to **QuickBooks Online** — Desktop cannot import bank transactions
  from CSV at all, so the generic name pointed Desktop users at a dead end
- The export screen now warns to set the date format at QuickBooks' mapping
  step. It defaults to day-first, which files anything before the 13th of a
  month in the wrong month **with no error at all**

### Parser — 2026-08-29

- **Amounts whose decimal point Vision read as a space are recovered.**
  `1. 49` and `$140. 35` (both verbatim from the Costco dump in the corpus)
  matched nothing at all before, so the receipt fell through to a
  largest-number guess. On the synthetic corpus the total was recovered on
  12.6% of receipts carrying this artifact; now 100%. Added as a fallback that
  runs only when the strict pattern finds nothing, so no line that already
  parsed can change meaning (D-045)
- `extractTotal` now shares the money scanner with everything else. It was
  still calling the raw regex, which meant it never picked up the
  "a printed rate is not an amount" guard added in r16
- Synthetic corpus grew two axes taken from the real corpus — the spaced
  decimal above, and a smudge fused onto the label (`wx TOTAL`). The second
  was already handled correctly; it is pinned so it stays that way
- CI now runs `test:synth` on every PR

### Exports — sales tax (2026-08-29)

- **Splitting a receipt no longer loses or invents cents of sales tax.** Each
  part was rounded on its own, so $1.00 of tax across three categories
  exported as $0.99 and $0.01 across two exported as $0.02. Sales tax feeds
  Schedule A line 5a, so the invented cent was an over-claim. Now
  largest-remainder in whole cents (D-048)
- The Summary screen uses the same split, so summing the CSV's "Sales Tax
  Portion" column gives exactly the figure the app displays

### Repository — 2026-08-29

- **Workflow inputs no longer reach the shell.** `${{ inputs.* }}` was written
  inline in four steps, so GitHub substituted the text before bash parsed it: an
  update message containing `$1000` became a shell expansion and killed the r16
  publish under `set -u`. Beyond the breakage, that shape lets arbitrary input
  run commands in a job holding `EXPO_TOKEN` and an Apple signing key. All four
  now pass through `env:`

### OTA — v1.0.0 (build 3) · js r16 — 2026-08-29

Two parser fixes, both found by the new synthetic corpus (D-041), both
affecting real receipts:

- **A printed tax rate is no longer read as the tax.** `TAX 8.25%  3.71`
  returned `8.25`. US receipts print the rate on the tax line constantly
- **Amounts over $999 no longer lose their leading digits.** `1124.06` parsed
  as `124.06`, and `12345.67` as `345.67` — a $12,345 purchase recorded as
  $345, with no error anywhere. This is the more serious of the two
- **Tips now count toward the total** (D-042). A card slip prints the pre-tip
  figure as "AMOUNT CHARGED" and the real amount lower down, so every tipped
  meal was under-deducted. Added only when the receipt prints the post-tip
  figure — a total that already includes the tip is not double-counted, a
  suggested-tip guide is not a charge, and a handwritten tip leaves the total
  alone. Over-reporting a deduction is the worse failure, so the rule only
  moves in the direction the receipt confirms
- `npm run test:synth` — thousands of generated receipts with exact ground
  truth, scored per format against a committed baseline. 35 unit tests, up
  from 23

### OTA — v1.0.0 (build 3) · js r13 — 2026-08-26

- **Tab bar uses Ionicons instead of emoji**, outline when inactive and solid
  when selected — the iOS idiom, and something emoji cannot express, which was
  most of why the old bar read as placeholder art
- Ships over the air: `expo-font` is already autolinked through `expo` itself,
  so `FontLoaderModule` is compiled into build 3, and the `.ttf` is a static
  `import` that Metro treats as an asset. No build required
- `@expo/vector-icons` promoted to a direct dependency. It was only reachable
  at `expo/node_modules/@expo/vector-icons`, so importing it directly would
  have failed to resolve at runtime, not just in `tsc`

### Repository — 2026-08-27

- `step: asc-iap` in the EAS workflow — reports the App Store Connect state of
  every in-app purchase product. StoreKit only hands a product to the app once
  App Store Connect considers it complete, so an empty paywall is usually a
  product-state problem wearing the costume of a code problem. Read-only, free

### Repository — 2026-08-26

- **CI on pull requests** (`.github/workflows/ci.yml`) — unit tests, `tsc`, and
  a check that `APP_BUILD`/`APP_VERSION` agree with `app.json`. Tests previously
  ran only when someone remembered to dispatch the EAS workflow, so nothing was
  verified at the moment a PR merged. The version check is aimed squarely at the
  D-039 drift and was negative-tested in both directions
- Pre-launch checklist added to `ROADMAP.md`

### v1.0.0 (build 3) · js r12 — 2026-08-26

Everything staged since build 2, in one build. Tyler lifted the build-rationing
constraint (end of the EAS billing month), so the batch shipped as a single
production build rather than waiting further.

Build `43156c07-a964-4a6c-b8a1-ae38d92586ea`, submission
`d680e7f6-f407-4e79-a458-c46c47b35335`. Credentials reused unchanged, so
`expo-document-picker` cost no credential regeneration (D-011 does not apply).

- **App header now reads TaxTrail.** Last user-visible instance of the old name;
  it survived two rename sweeps as `Receipt<Text>Snap</Text>`, split across JSX
  nodes (D-040)
- **New app icon** — a receipt cut at both ends, shallow teeth, generated from
  `mobile/scripts/make-icons.py` (D-038)
- **`taxtrail://capture` deep link** opens straight into the scanner (D-024),
  which is what makes a Control Centre / Lock Screen / Action Button shortcut
  worth setting up. Verified in the generated `Info.plist`: `CFBundleURLTypes`
  carries `taxtrail`, permissions unchanged at five, entitlements still empty
- **Restore from a receipt archive** (`expo-document-picker`) — closes the loop
  D-016 opened. The archive export has existed since js r3 with nothing able to
  read it back, which makes it a backup in name only. Re-importing the same
  archive is a no-op: rows are fingerprinted on merchant + date + total, and
  duplicates within one archive collapse too. A row whose image is missing still
  imports — the data is the tax record, the photo is the substantiation
- Restore is **hidden** unless `expo-document-picker` is present, since JS ships
  over the air and can land on a binary compiled without the native module
- `mobile/src/lib/restorePlan.js` — the pure half, with 8 tests. 18/18 green
- **Build numbers now live in git** (D-039). `autoIncrement` is off, and a free
  App Store Connect read fails the workflow before `eas build` spends quota if
  the number is already taken. Its first run confirmed the diagnosis outright —
  Apple reported `['2']` as the only number on file for 1.0.0, which is exactly
  what `autoIncrement` would have produced again
- `step: update` can target a channel (it hardcoded `development`, so it could
  never reach TestFlight); it now prints the target binary and version stamp
  before publishing

### OTA — v1.0.0 (build 2) · js r12 — 2026-08-26

Published to the **`production`** channel, so it reached the TestFlight build
without a native build. Update group `2cb556d9-e656-4109-aae9-eeeadc5066ba`,
runtime `1.0.0`, from commit `4de5450`.

- Carries the **TaxTrail header fix** to build 2, which had been showing
  *ReceiptSnap* since 2026-08-21 (D-040)
- Deliberately published **before** the build-number bump landed, so the bundle
  still carries `APP_BUILD = 2` and build 2 reports itself correctly. The deep
  link is inert there (no URL scheme in that binary) and the Restore card stays
  hidden (`isRestoreAvailable()` finds no `expo-document-picker`)
- Required fixing `step: update`, which hardcoded `--branch development` and so
  could never reach TestFlight at all

### v1.0.0 (build 2) · js r11 — 2026-08-21

First build under the TaxTrail identity, and the first App Store distribution
build. Submitted to TestFlight (submission `833b2322…`).

- Bundle identifier `com.tylerthornbrue.taxtrail`, distribution certificate and
  provisioning profile created (D-037)
- **The footer on this build reads `build 1`** — `autoIncrement` bumped the
  number on the runner without committing it, so the repo and the binary
  disagreed. Fixed in the entry below (D-039)
- **The header on this build reads `ReceiptSnap`** — the rename missed it, and
  the PR that claimed to fix it shipped no app changes at all (D-040)

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

### 2026-08-17

- `.github/workflows/revenuecat.yml` — RevenueCat driver (D-036), `status` and
  `set-bundle-id`. Third service on the same pattern as Cloudflare and Apple
- Records that the `appl_` key already in the repo is the **public SDK key** and
  cannot manage the project; a v2 secret key is a different credential

### 2026-08-21

- **Build 2 submitted to TestFlight** — submission
  `833b2322-d1e7-4395-9a72-d9ebf0c4e614`
- `eas.yml`: `submit` step, gated on `confirm_submit: SUBMIT` like the build
- `eas.json`: iOS submit profile carries `ascAppId` and points at the ASC key
  through `env-string` interpolation. Submit resolves Apple credentials
  differently from build — it does not read the build's env vars
- `asc-check` prints `ascAppId`, so the value comes from Apple rather than a
  dashboard URL

### 2026-08-16

- **App Store Connect API key wired into CI** (D-034). Verified against
  eas-cli 22's shipped code: the Codespace was never required for credentials —
  an ASC API key was. Supersedes D-004
- `eas.yml`: `asc-check` and `asc-bundle-id` steps talk to Apple's REST API
  directly, so the key can be validated and the App ID created **without
  spending a build**
- Apple App ID `com.tylerthornbrue.taxtrail` created; the App Store Connect
  record now carries it

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
