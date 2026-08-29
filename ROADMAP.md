# Roadmap

Ordered by the constraint that actually governs this product: **tax season**.
Installs run ~5x in late January and collapse ~98% after April 15. Everything
before January is preparation for that window.

Full reasoning: `MARKET_AND_GTM_STRATEGY.md` §5.3.

---

## Pre-launch checklist — agreed 2026-08-26

Everything that stands between build 3 and an App Store submission. Ordered by
what blocks what, not by size.

### Blocked on Apple (start these first — they are pure waiting)

- [x] **Paid Applications agreement — ACTIVE** (confirmed 2026-08-27). This was
      the gate on the whole purchase flow; testing the paywall is now possible
      for the first time.
- [x] **All three products verified fetchable** (2026-08-29). The blocker was
      the subscription group having no localization, not anything on the
      products; fixed by setting the group display name to "TaxTrail Pro".
      `step: asc-iap` re-run confirms `READY_TO_SUBMIT` across the board.
- [ ] **Test a sandbox purchase end to end** — monthly, annual and the lifetime
      unlock, plus Restore Purchases
- [ ] Confirm **App Store Small Business Program** acceptance (applied; Apple
      quotes "over a month", and the 15% rate applies 15 days after the end of
      the fiscal month of approval)

### Correctness — the highest-risk item

- [x] **Audit every export format aimed at a specific tax package** (D-046).
      Tyler's call, and the right one: it found five real defects.
      - [x] **TXF sign convention — already correct.** Negative is what the
            v042 spec requires for expense codes. Verified against four
            independent copies including a capture of Intuit's own page. Do
            not "fix" this later.
      - [x] TXF record structure — header date now zero-padded (`D08/01/2026`,
            was `D8/1/2026`), `A` record carries the version, and the `X` line
            is gone from summary records: `X` is a detail-record field whose
            layout is columnar, so a bare category name sat where an importer
            expects a date
      - [x] **Refnum 302 is Record Format 3**, not 1. Each "other" category now
            gets its own record with a `P` description and an incrementing `L`,
            which is how Part V itemization is meant to survive. The old output
            merged five categories into one record and lost it
      - [x] `TXF_CODES` -> Schedule C mapping — two were wrong. Postage moved
            to 313 (line 18) and Employee Benefits to 308 (line 14); the
            latter had the export contradicting the app's own UI
      - [x] **Schedule C line 27a is 27b for TY2025** — the IRS swapped the
            sub-lines. Four labels were correct for TY2024 and wrong for the
            returns being filed now
      - [x] QuickBooks: BOM dropped from that file only, renamed "QuickBooks
            Online" (Desktop cannot import bank CSV at all), and the export
            screen now warns to set the date format at the mapping step —
            day-first silently files anything before the 13th in the wrong
            month
      - [x] **Sales-tax split was losing and inventing cents** (D-048).
            Each part was rounded independently, so $1.00 across three
            categories exported as $0.99 and $0.01 across two exported as
            $0.02. Now largest-remainder in whole cents, and the Summary
            screen uses the same split so the app and the file agree
      - [x] CPA CSV and XLSX: headers, form grouping and money formatting.
            The workbook was built and read back rather than eyeballed — the
            two files share one header row, the form grouping and within-form
            ordering are correct, and the business sales-tax figure now comes
            out at exactly $1.00 on the split-receipt case that used to give
            $0.99. Money columns are now written with a number format, so a
            CPA reads 10.00 rather than 10
      - [ ] End-to-end import into at least one real package. **This is the
            part no amount of spec-reading substitutes for** — it needs Tyler
            or a trial licence.
      - [x] Removed the dead ExcelJS `buildWorkbook` path in `exporters.js`
            (144 lines) — never reachable from the app; the real .xlsx is built
            by `xlsxExport.ts` with SheetJS

### Parser quality

- [x] **Synthetic corpus** (D-041) — `npm run test:synth` scores the parser over
      thousands of generated receipts with exact ground truth. Found and fixed
      two real bugs on its first run, including amounts over $999 losing their
      leading digits.
- [x] **Tips count toward the total** (D-042) — Tyler's call. Added only when
      the receipt prints the post-tip figure, so a total that already includes
      the tip is never double-counted and a deduction is never inflated.
- [ ] **Grow the real corpus.** Tyler scans real receipts, exports Summary ->
      *Parser diagnostics*, and the dump lands in `mobile/__tests__/corpus/`.
      Still the only on-distribution data — synthetic supplements it, never
      replaces it.
- [x] **Made the synthetic corpus adversarial again** (D-045). It had reached
      100% on every axis, which measures the generator rather than the parser.
      Two new axes taken from artifacts in the real corpus: a decimal point
      scanned as a space (`1. 49`) and a smudge fused to the label
      (`wx TOTAL`). The first was a real defect — the total was recovered on
      only 12.6% of receipts carrying it — and is fixed; the second was
      already handled and is now pinned
- [x] **Receipt splitting could exceed the receipt** (D-049) — found while
      hardening something the export audit called unreachable. It was
      reachable: the negative came from subtraction, not from typing a minus
- [ ] Fix whatever the score run flags, with a fixture per bug
- [ ] **Costco receipts land Uncategorized / low-confidence** — both real
      Costco dumps get the *amounts* right but the merchant line is OCR
      garbage (`Bw  Yai Grup`), so no category matches. Arguably correct
      behaviour rather than a bug — the app asks the user to pick — but worth
      a look at whether store-number or item lines could carry the merchant

### Polish

- [x] **Tab bar icons: Ionicons, outline/filled by state** (js r13) — the emoji
      set read as placeholder art
- [x] `SKStoreReviewController` prompt — was already implemented, but keyed on
      `countThisMonth() === 3`, so it re-fired on the third scan of every month
      and could be skipped entirely. Now a lifetime count with a persisted
      "asked" flag (D-043)
- [x] Free-tier gate covered by tests at the boundary — the decision moved to
      `src/lib/gates.js`, where "what happens on the 11th scan" is a unit test
      rather than eleven scans on a phone

### Store submission

- [ ] Screenshots — **screenshot 2 is the privacy-label comparison** against
      Keeper / QuickBooks / Wave; that contrast is the entire pitch
- [ ] App Privacy questionnaire answers (drafted in `docs/APP_STORE_LISTING.md`)
- [ ] App Review notes explaining on-device OCR, so the "Data Not Collected"
      claim is not challenged
- [x] **Final listing copy pass** — every number checked against the code.
      "29 categories" was wrong (28 are selectable; the 29th is
      "Uncategorized"), and the QuickBooks wording promised Desktop users a
      format Desktop cannot import. Both corrected; the rest verified accurate
- [x] **Renamed "Meals & Entertainment" to "Business Meals"** (D-050), with a
      real migration: a `PRAGMA user_version` runner (there was none before),
      plus alias mapping on archive restore so old backups still import
- [x] **Schedule C line coverage audited against the 2025 form** (D-050). One
      real gap — line 20a — now covered by a new **Equipment Rental** category
      (TXF 299). Four lines stay uncovered on purpose because they are not
      receipt-shaped: 12 depletion, 16a mortgage interest (Form 1098), 19
      pension plans, 27a Form 7205
- [ ] **Decide where moving trucks belong** — U-Haul/Penske/Ryder are a
      vehicle rental by the letter of line 20a but a travel cost in practice.
      Left where they land today rather than moved on a coin flip; a keyword
      addition either way

### Engineering hygiene

- [x] **CI on pull requests** — `.github/workflows/ci.yml`: unit tests, `tsc`,
      and a version-stamp check that would have caught the D-039 drift
- [x] **Android audited and explicitly parked** (D-047). The audit overturned
      the standing assumption: OCR is *not* the blocker —
      `expo-text-extractor` has an Android build, every other dependency does
      too, `app.json` already has the package name and adaptive icon, and the
      only `Platform.OS` branches in the app are a keyboard behaviour and a
      font name. It is parked because the parser is tuned on Apple Vision and
      Android uses ML Kit (a different engine, accuracy unknown, and the
      *unbundled* variant that pulls its model through Play Services — which
      needs a careful answer for the privacy label), plus a second store is a
      second everything, and tax season governs. Revisit after iOS ships, and
      start by collecting an ML Kit corpus

### Deferred, with reasons

- Native Control Center control (D-024) — needs a WidgetKit `ControlWidget`,
  which is SDK 56 / `@bacons/apple-targets` territory. The user-made Shortcut
  on `taxtrail://capture` covers it for now.
- Store every page of a multi-page receipt (schema migration)

---

## Now — get the dev client onto the phone

- [x] EAS project created and OTA-configured
- [x] Apple signing credentials
- [x] Native dependency set locked in before the one build
- [ ] Install the dev client on Tyler's iPhone
- [ ] Confirm the app runs, scans, and parses on-device
- [ ] Verify the version stamp reads `v1.0.0 (build 1) · js r1`

## Next — OCR quality, on device

The native modules are compiled in; the work is now all JS and ships over the
air.

- [x] Wire the **document scanner** into the capture flow, replacing the raw
      `expo-image-picker` photo path (js r3)
- [x] Multi-page capture for long receipts a single frame can't hold (js r3)
- [x] Receipt archive export — images can leave the device (js r3, D-016)
- [x] Restore from an archive — done, staged for the next build (D-040)
- [ ] Store every page of a multi-page receipt, not just the first (schema
      migration: one image per receipt today)
- [x] Parser diagnostics export — raw OCR text + what the parser made of it
      (js r4)
- [x] Classifier scoring harness, `npm run test:score` (js r4)
- [x] Pinch-zoom on receipt photos in review and detail (js r4)
- [ ] Add a regression fixture for every parser bug Tyler hits in real use

## Personal receipts — the returns use case (all JS, no build)

Tyler's idea: keep personal receipts separately from tax receipts, and find one
by searching an item or **scanning the product's barcode**, to get the original
image back for a return.

**Verified: no native work needed.** `expo-camera@55.0.21` is already compiled
into build 1 and exposes `onBarcodeScanned` / `scanFromURLAsync` for `upc_a`,
`upc_e`, `ean13`, `ean8`, `code128`, `code39`, `itf14`, `pdf417`, `qr`, `aztec`
and `datamatrix`. The whole feature ships over the air.

- [ ] Segmentation: a `kind` column (`business` | `personal`) with a tab or
      filter, so personal receipts never reach a Schedule C export
- [ ] Store OCR line items so an item search has something to match
- [ ] Barcode lookup: scan a UPC → match against stored line items → show the
      receipt image and the purchase date
- [ ] Return-window surfacing (a competitor already ships expiry alerts — see
      `docs/MARKET_REASSESSMENT_2026-08.md` §1)

## Then — monetization (all JS, no build required)

Decided in `DECISIONS.md` D-002. Nothing here needs a native build; RevenueCat
products are fetched at runtime. Dashboard/store config is being driven from
Atlas via the RevenueCat MCP (2026-08-02, checkpointed session — see STATUS.md);
the MCP's store-state tools proved able to create ASC products directly,
including the `ONE_WEEK` trial, so most of the console work below is API work.

- [x] RevenueCat project `proj63a7fa32` + restore behavior
      "Transfer if there are no active subscriptions" (D-012)
- [x] App Store Connect app record — **"ReceiptSnap: Expense Organizer"**
      (name "ReceiptSnap" was taken; D-013)
- [x] RevenueCat dashboard: iOS app `appc76b61980d`, entitlement `pro` (all
      three products attached, incl. the non-consumable), offering `default`
      with `$rc_monthly` / `$rc_annual` / `$rc_lifetime`; public SDK key
      issued (see STATUS.md)
- [x] App Store Connect: subscription group **ReceiptSnap Pro** with
      `receiptsnap_pro_monthly` ($6.99), `receiptsnap_pro_annual` ($39.99,
      7-day trial), `receiptsnap_pro_lifetime` ($99.99 non-consumable,
      **outside** the group) — created via MCP 2026-08-02; submission-time
      metadata (screenshots, privacy URL) still pending (STATUS.md)
- [x] Public RevenueCat Apple key wired into `src/lib/config.ts` (js r2)
- [x] Free tier enforced — `CaptureScreen` gates on `FREE_SCANS_PER_MONTH`
- [ ] Paywall at the 10-scan wall, annual trial highlighted
- [ ] Enrol in the App Store Small Business Program (15%) — before the first
      sale; not retroactive

## Before the production build — batch these, they each need a binary

The rename forces a new bundle identifier, which forces a build. Anything else
that touches `Info.plist` or entitlements should ride along in the same one.

- [x] **Clear a name and rename everywhere** — now **TaxTrail** (D-026).
      Bundle identifier changed, so a new provisioning profile is required
      before this build
- [x] **URL scheme + `capture` deep link** (D-024) — `taxtrail://capture`.
      Unlocks a Control Center / Lock Screen / Action Button button via a
      one-action user shortcut, plus Android launcher shortcuts. Staged
- [x] `expo-document-picker`, for restore-from-archive — staged
- [x] **App header reads TaxTrail** (D-040) — staged; build 2 still says
      ReceiptSnap
- [ ] Store every page of a multi-page receipt (schema migration)

## Sep–Oct 2026 — soft launch

- [x] Production build — build 2, `8fdd9bd0…`, 2026-08-21
- [x] Upload to App Store Connect / TestFlight — 2026-08-21
- [ ] Install from TestFlight and use it on a real receipt run
- [ ] App Store review submission (listing metadata, screenshots, privacy answers)
- [ ] Listing: subtitle "Private, on-device tax scans"; **screenshot 2 is the
      privacy-label comparison** against Keeper / QuickBooks / Wave — that
      contrast is the whole pitch
- [ ] App Review notes explaining on-device OCR, so the "no data" claim isn't
      challenged
- [ ] `SKStoreReviewController` prompt after the 3rd successful scan
- [ ] Targets: crash-free ≥ 99.5%, 50+ ratings at 4.7+ before January

## Nov–Dec 2026 — stage the season

- [ ] Mileage log. **Manual odometer entry ships via OTA; GPS tracking needs
      `expo-location`**, which is already compiled in — see D-006
- [ ] Quarterly estimated-tax reminders via local notifications (the off-season
      reason to keep the app installed)
- [ ] Year-end summary polish
- [ ] Tax-season metadata and screenshots submitted by mid-December
- [ ] Creator campaign booked; Product Hunt scheduled for January

## Jan 1 – Apr 15 2027 — the revenue window

- [ ] Apple Search Ads, exact-match high-intent terms only, $10–20/day, kill
      anything above $60 CAC
- [ ] January intro offer: first year $29.99
- [ ] A/B the paywall via RevenueCat (remote-configurable, no build)

## After April 2027

- [ ] Retention features so the app has an off-season purpose
- [ ] Android evaluation. Note the Android config was never audited — the
      `RECORD_AUDIO` permission was removed, but the whole Android surface needs
      a pass before it's taken seriously
- [ ] Renew Apple credentials — **they expire 31 May 2027** and renewal requires
      an interactive Codespace trip (D-004)

---

## Parked, deliberately

- **Siri / App Intents / a native Control Center control** — "Hey Siri, scan a
  receipt", and a control with our own icon that needs no user setup. Verified
  possible on our SDK via `@bacons/apple-targets@5.0.0` (`widget` / `app-intent`
  targets, built against `expo ^55`), but it means hand-written SwiftUI and an
  App Group entitlement — and an entitlement invalidates the provisioning
  profile (D-011), so it costs a credentials trip on top of a build. Expo's own
  `expo-widgets` is SDK 56+. Revisit at the SDK 56 upgrade. See D-024.
- **Android Quick Settings tile** — the true Control Center analogue. Needs a
  `TileService`; no Expo wrapper exists. Waits for the Android audit.
- **Live Text / VisionKit DataScanner** — real-time recognition in the camera
  preview. No maintained Expo wrapper; would need a custom native module.
- **A navigation library** — see D-009.
