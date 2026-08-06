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
- [ ] Port the PWA's diagnostic long-press pipeline to the app, so parser bugs
      can be reported with the raw OCR text attached
- [ ] Add a regression fixture for every parser bug Tyler hits in real use

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
- [ ] Replace `appl_REPLACE_ME` in `src/lib/config.ts` with the public Apple key
- [ ] Enforce the free tier (`FREE_SCANS_PER_MONTH = 10`)
- [ ] Paywall at the 10-scan wall, annual trial highlighted
- [ ] Enrol in the App Store Small Business Program (15%) — before the first
      sale; not retroactive

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

- **Siri / App Intents / widgets** — "Hey Siri, scan a receipt" is genuinely
  attractive, but it's a large native lift. Revisit when the app has users.
- **Live Text / VisionKit DataScanner** — real-time recognition in the camera
  preview. No maintained Expo wrapper; would need a custom native module.
- **A navigation library** — see D-009.
