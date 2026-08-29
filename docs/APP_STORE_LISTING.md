# App Store listing — draft copy

Everything App Store Connect asks for, drafted and ready to paste. Character
limits are Apple's; counts are given where they're tight.

App record: **TaxTrail: Receipt Scanner** — renamed 2026-08-10 (D-026). The
previous name "ReceiptSnap: Expense Organizer" was itself a fallback, because
plain "ReceiptSnap" was taken (D-013); that refusal was the signal nobody read.
Bare "TaxTrail" and "Tax Trail" were also refused. Bundle
`com.tylerthornbrue.taxtrail`.

---

## Name (30 max)

```
TaxTrail: Receipt Scanner
```
25 characters, five to spare. Set in App Store Connect 2026-08-10.

## Subtitle (30 max)

```
Categorization for Schedule C
```
29 characters. Tyler's choice, and the right one: the name now carries "tax", so
the subtitle should carry what nothing else in the category does. Alternates
worth A/B testing, both within the limit — "Private, on-device tax scans" (28)
and "Tax-ready by April 15" (21).

## Promotional text (170 max, editable without review)

```
Scan a receipt, get the right IRS Schedule C line. No account, no cloud —
your receipts never leave your phone.
```

Because this field updates without a review cycle, use it for seasonal pushes:
January "Tax season is here", April "Deadline in two weeks".

## Description

```
TaxTrail turns a photo of a receipt into a categorized, tax-ready expense —
without sending it anywhere.

Everything happens on your iPhone. The text recognition, the categorization, the
math. There is no account to create, no cloud to sync with, and no server that
receives your receipts. Your financial records stay yours.

SORTED FOR YOUR TAX RETURN
Every receipt is filed to one of 28 categories mapped to real IRS lines —
Schedule C, plus Schedule A, Form 8829, Form 4562, and cost of goods sold.
When a purchase is partly personal, split it: the sales tax splits with it.

BUILT FOR REAL RECEIPTS
Apple's document scanner finds the receipt's edges, flattens it, and sharpens
the print before anything is read — so faded thermal paper and crumpled corners
still work. Long receipts are captured across multiple pages and read as one.

EXPORTS YOUR ACCOUNTANT WILL ACCEPT
CSV organized by IRS form. Excel workbooks. TXF for tax software. A
three-column CSV for QuickBooks Online. Plus a full archive containing every
receipt image alongside the data, so you have the copies the IRS expects you
to be able to produce.

SALES TAX, TRACKED PROPERLY
TaxTrail reads the printed tax rate when there is one, remembers rates by
city, and derives them when it must. Sales tax is separated from the amount,
because your deduction depends on it.

FREE TO START
10 scans a month with full parsing, categorization, and CSV export. TaxTrail
Pro unlocks unlimited scans and every export format.

NO ADS. EVER.
Not now, not later. An app that reads your receipts should not be in the
advertising business.

TaxTrail is a record-keeping tool, not tax advice. Check with your tax
professional about your situation.
```

## Keywords (100 max, comma-separated, no spaces)

```
receipt,scanner,expense,tracker,tax,schedulec,1099,selfemployed,mileage,irs,deduction,cpa,offline
```
97 characters. Dropped "bookkeeping" (the original draft was 105, over the limit) and added "cpa". Don't repeat words already in the name or subtitle — Apple indexes
those separately, so spending keyword characters on them is waste.

## What's New (first release)

```
First release. Scan receipts, get them filed to the right IRS line, export for
your accountant — all on your device.
```

## URLs

| Field | Value |
|---|---|
| Support URL | `https://taxtrail.app/support` |
| Privacy Policy URL | `https://taxtrail.app/privacy` |
| Marketing URL | optional — leave blank until there's a real site |

**Use the extensionless forms above.** Verified 2026-08-29: the `.html` URLs
return a 308 to these, which Apple follows fine, but there is no reason to
hand a reviewer a redirect. Both final URLs return 200 with real content, and
both pages carry `support@taxtrail.app` as the contact (it is behind
Cloudflare's email obfuscation in the HTML, so a naive grep shows
`[email protected]` — the address is really there).

`support@taxtrail.app` is **confirmed working end to end** (2026-08-29): Tyler
sent a test message and it arrived in his Gmail via the Cloudflare Email
Routing forward. Nothing further to check here.

---

## App Review notes

Paste into "Notes" on the submission. This pre-empts the most likely reason for
rejection or a delay: a reviewer distrusting the privacy claim.

```
TaxTrail performs all receipt processing on-device.

- Text recognition uses Apple's Vision framework (via expo-text-extractor).
  No image or recognized text is transmitted anywhere.
- There is no account system, no backend, and no analytics or advertising SDK.
- Receipt data is stored in a local SQLite database; images are stored in the
  app container.
- Exports are handed to the system share sheet; the user chooses the
  destination. The app has no network destination of its own.
- The only network activity is subscription validation via RevenueCat, and
  over-the-air JS updates via Expo. Neither receives receipt data.
- The paywall links to Apple's standard EULA and to the privacy policy. Those
  open in Safari when tapped; the app itself issues no HTTP requests.

Permissions:
- Camera — photographing receipts.
- Photo library — importing an existing receipt picture chosen by the user.
- Face ID — optional app lock. No biometric data is accessed.
- Location (when in use) — optional mileage logging. Declining leaves all other
  functionality intact.

These four are the complete set. Verified 2026-08-29 against the plugin
configuration in `app.json`: `expo-image-picker` and `expo-camera` both set
`microphonePermission: false`, and `expo-location` sets both always-on variants
to `false`, so none of those keys is generated (D-007). The local-network key
`expo-dev-launcher` adds in development is stripped by a build phase in any
non-Debug configuration, so it does not ship either (D-044).

To test Pro without purchasing, use the sandbox account provided, or note that
the free tier permits 10 scans per month with full parsing and CSV export.
```

## App Privacy questionnaire

Resolved — see D-022. Answer exactly this:

**Data collected: Purchases → Purchase History**

| Question | Answer |
|---|---|
| Purposes | **Analytics** and **App Functionality** (RevenueCat requires both) |
| Linked to the user's identity? | **No** — anonymous app user IDs, no server of ours |
| Used for tracking? | **No** — no advertising or attribution SDKs |

**Everything else: not collected.** No contact info, health, financial info,
location, sensitive info, contacts, browsing or search history, identifiers, or
diagnostics. Identifiers is *not* required — RevenueCat needs it only if purchase
history is linked to identity or an ad identifier is used, and neither applies.

Resulting label:

> **Data Not Linked to You** — Purchases

Nothing about receipts is collected: no photos, no recognized text, no merchants,
amounts, or categories. That is the claim to defend, and it is true.

## Screenshots

Six slots. Apple requires 6.9" (iPhone 16 Pro Max class); 6.5" is accepted for
older-device coverage. The order matters more than the polish:

1. **Capture → parsed result.** The core loop in one image.
2. **Privacy label comparison** — TaxTrail beside Keeper, QuickBooks, and
   Wave. This is the pitch; put it where people actually still swipe.
3. **Category list**, showing real IRS line numbers. Proves depth.
4. **Summary by Schedule C line**, with a year total.
5. **Export sheet** — CSV, Excel, TXF, QuickBooks Online, archive.
6. **Receipt split**, showing tax-aware division.

Caption every one. Screenshots are read as a slideshow, not studied.

## Copy accuracy — checked against the code 2026-08-29

Tyler's standing rule is to verify claims rather than inherit them. Every
number in the copy above was checked against what the app actually does:

| Claim | Reality | Verdict |
|---|---|---|
| "28 categories" | 28 selectable, plus "Uncategorized" which is the absence of one | **Was "29"** — counting Uncategorized as a category is a stretch a reviewer could call. Corrected |
| "10 scans a month" | `FREE_SCANS_PER_MONTH = 10` in `src/lib/config.ts`, and the boundary is unit-tested (D-043) | Accurate |
| "mapped to real IRS lines" | Schedule C, Schedule A, Form 8829, Form 4562, Part III COGS — all present | Accurate |
| "your receipts never leave your phone" | No analytics or ad dependency; the only URLs in `src/` are two `Linking.openURL` targets on the paywall | Accurate |
| "QuickBooks three-column CSV" | The format is QuickBooks **Online** only; Desktop cannot import bank CSV | **Corrected** — the old wording promised Desktop users something that cannot work |
| "Apple's document scanner ... multiple pages" | `react-native-document-scanner-plugin`, multi-page capture shipped in js r3 | Accurate |

### Left for Tyler — a naming call, not a bug

The category **"Meals & Entertainment"** is a misnomer. Entertainment has been
nondeductible since the TCJA, and the Schedule C instructions say twice "Do not
include entertainment expenses on this line". The label invites a user to file
an entertainment receipt into a 50%-deductible bucket. "Business Meals" would
be accurate.

Not changed unilaterally because the category name is stored as a string on
every saved receipt and inside every allocation, so a rename needs a data
migration — not a one-line edit, and not something to do unattended.

## Pre-submission checklist

- [x] D-022 resolved; App Privacy answers match reality — **re-verified
      2026-08-29 against the code**: no analytics or advertising dependency in
      `package.json`, and the only URLs anywhere in `src/` are the two
      `Linking.openURL` targets on the paywall. The app makes no HTTP request
      of its own, so "nothing about receipts is collected" is defensible as
      written
- [x] Contact email filled into `privacy.html` and `support.html` —
      `support@taxtrail.app` on both, and **delivery confirmed end to end**
      (test message arrived in Gmail via the Cloudflare forward, 2026-08-29)
- [x] Both URLs load — 200 after a 308 to the extensionless form. Use the
      extensionless URLs in App Store Connect
- [ ] Production build (`channel: production`) — the dev-only update button
      disappears automatically (D-019)
- [ ] Screenshots at required sizes
- [ ] App Review notes pasted
- [ ] Age rating completed
- [ ] Export compliance — `ITSAppUsesNonExemptEncryption: false` is already set
- [ ] **App Store Small Business Program enrolled** — 15% instead of 30%, and it
      is not retroactive, so this must happen before the first sale
- [ ] Paid Applications agreement signed, or products won't load
