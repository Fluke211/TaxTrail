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
Every receipt is filed to one of 29 categories mapped to real IRS lines —
Schedule C, plus Schedule A, Form 8829, Form 4562, and cost of goods sold.
When a purchase is partly personal, split it: the sales tax splits with it.

BUILT FOR REAL RECEIPTS
Apple's document scanner finds the receipt's edges, flattens it, and sharpens
the print before anything is read — so faded thermal paper and crumpled corners
still work. Long receipts are captured across multiple pages and read as one.

EXPORTS YOUR ACCOUNTANT WILL ACCEPT
CSV organized by IRS form. Excel workbooks. TXF for tax software. QuickBooks
three-column CSV. Plus a full archive containing every receipt image alongside
the data, so you have the copies the IRS expects you to be able to produce.

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
| Support URL | `https://taxtrail.app/support.html` |
| Privacy Policy URL | `https://taxtrail.app/privacy.html` |
| Marketing URL | optional — leave blank until there's a real site |

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

Permissions:
- Camera — photographing receipts.
- Photo library — importing an existing receipt picture chosen by the user.
- Face ID — optional app lock. No biometric data is accessed.
- Location (when in use) — optional mileage logging. Declining leaves all other
  functionality intact.

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
5. **Export sheet** — CSV, Excel, TXF, QuickBooks, archive.
6. **Receipt split**, showing tax-aware division.

Caption every one. Screenshots are read as a slideshow, not studied.

## Pre-submission checklist

- [ ] D-022 resolved; App Privacy answers match reality
- [ ] Contact email filled into `privacy.html` and `support.html`
- [ ] Both URLs load
- [ ] Production build (`channel: production`) — the dev-only update button
      disappears automatically (D-019)
- [ ] Screenshots at required sizes
- [ ] App Review notes pasted
- [ ] Age rating completed
- [ ] Export compliance — `ITSAppUsesNonExemptEncryption: false` is already set
- [ ] **App Store Small Business Program enrolled** — 15% instead of 30%, and it
      is not retroactive, so this must happen before the first sale
- [ ] Paid Applications agreement signed, or products won't load
