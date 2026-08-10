# Roadmap

Ordered by the constraint that actually governs this product: **tax season**.
Installs run ~5x in late January and collapse ~98% after April 15. Everything
before January is preparation for that window.

Full reasoning: `MARKET_AND_GTM_STRATEGY.md` §5.3.

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
- [ ] Restore from an archive — needs `expo-document-picker`, so it waits for
      the production build
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

- [ ] **Clear a name and rename everywhere** — shortlist and procedure in
      `docs/NAMING_2026-08.md`; blocked on Tyler running the App Store Connect
      and USPTO checks
- [ ] **URL scheme + `capture` deep link** (D-024). `mobile/app.json` has no
      `scheme` today. Unlocks a Control Center / Lock Screen / Action Button
      button via a one-action user shortcut, plus Android launcher shortcuts
- [ ] `expo-document-picker`, for restore-from-archive
- [ ] Store every page of a multi-page receipt (schema migration)

## Sep–Oct 2026 — soft launch

- [ ] Production build + App Store submission
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
