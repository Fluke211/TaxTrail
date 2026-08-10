# Market reassessment — August 2026

Triggered by discovering that "ReceiptSnap" is an existing App Store app with a
near-identical product. This supersedes the competitive findings in
`MARKET_AND_GTM_STRATEGY.md` §2.2, which are now known to be wrong.

Sources are live searches performed 2026-08-07. **Nothing here is from memory.**

---

## 1. The name is unusable

At least four shipping apps use it:

| App | Store | What it does |
|---|---|---|
| ReceiptSnap (Derek Paget) | [iOS](https://apps.apple.com/us/app/receiptsnap/id6749952858) | Snap → email to QuickBooks / FreshBooks / Xero |
| ReceiptSnap: Scan & Track | [iOS](https://apps.apple.com/us/app/receiptsnap-scan-track/id6760768036) | AI scan; **return-expiry alerts at 7 / 2 / final day** |
| ReceiptSnap | [iOS](https://apps.apple.com/in/app/receiptsnap/id6755453355) | third listing |
| ReceiptSnap – Track Receipts | [Android](https://play.google.com/store/apps/details?id=com.lunica.receiptsnap) | *"AI-powered OCR. Your data is stored on your device."* |

The App Store Connect record was already forced to "ReceiptSnap: Expense
Organizer" because the plain name was taken (D-013). That should have been read
as a competitor signal at the time. It was not.

Beyond legal risk, a name that collides with three incumbents is an ASO
liability: searches for it surface them, not us.

## 2. The positioning is contested — this matters more

`MARKET_AND_GTM_STRATEGY.md` §2.2 claims: *"On-device/no-account is empty. The
only occupants have 1 rating each. First credible mover owns the position."*

**That is no longer true.**

- **[DocuFlexPro](https://docuflexpro.com/)** — "100% on-device AI, receipts
  never leave your phone, no cloud storage, no account required." On-device
  DistilBERT extracting vendor, date, total, tax, payment method with no
  internet. Splits GST/HST/PST/QST, handles tax-inclusive pricing and fuel
  receipts, multi-language, and reportedly offers IRS Schedule C export. Its own
  copy pitches "tracking purchases, **finding receipts for returns**, and staying
  organized at tax time."
- **[Free Receipt Scanner](https://play.google.com/store/apps/details?id=com.freereceiptscanner.app)**
  — on-device OCR, local storage only, no accounts, no cloud, works offline,
  **no subscriptions**.
- **ReceiptSnap – Track Receipts** (above) also claims on-device storage.

So both halves of the plan are occupied: the privacy position *and* the returns
idea.

## 3. What is still genuinely differentiated

Not the privacy claim by itself. What the competitors above do **not** appear to
match:

1. **US Schedule C depth.** 29 categories mapped to specific IRS lines, plus
   Schedule A, Form 8829, Form 4562, and COGS. DocuFlexPro's tax sophistication
   is Canadian sales tax; its Schedule C support looks like an export format
   rather than a categorization model.
2. **Tax-aware receipt splitting.** Splitting a part-personal purchase and
   dividing the sales tax with it. Not seen elsewhere.
3. **TXF export.** Direct import into tax software. Rare.
4. **Sales-tax rate memory by city**, with printed-rate detection and derivation.
5. **The archive export** — every image plus the data, for IRS Rev. Proc. 97-22
   recordkeeping.

That is a *depth* story, not a *privacy* story. The honest framing is
"the receipt scanner that actually understands Schedule C", with on-device
privacy as a strong supporting claim rather than the headline.

## 4. Pricing pressure

At least one direct competitor is **free with no subscription**. The $39.99/yr
annual (D-002) was priced against Foreceipt ($59.99), SparkReceipt ($69.99) and
Keeper ($199) — cloud products with server costs. It was not priced against a
free on-device competitor.

This does not necessarily invalidate the pricing — free apps with no revenue
model tend not to survive, and depth is worth paying for — but D-002's reasoning
rests on a competitive set that is now incomplete. Revisit before launch.

## 5. Naming criteria going forward

Every candidate must clear **all** of these, verified live, before any of it is
written into the repo:

1. **App Store search** — no existing app with the name or a near-miss, on iOS
   *or* Android.
2. **USPTO** — no live registered mark in class 9 / 42 for the name or a
   confusingly similar one. Descriptive names ("Receipt" + verb) are both weak
   as marks and crowded.
3. **Domain** — at least one credible domain available.
4. **Distinctiveness** — avoid `Receipt` + {Snap, Scan, Track, Box, Keeper}.
   That zone is saturated and unprotectable. Coined or suggestive names are
   defensible; descriptive ones are not.
5. **ASO** — the name should not compete with incumbents for its own searches.

## 6. What this costs to change

Cheap, because nothing has shipped publicly:

| Item | Effort |
|---|---|
| App Store Connect app record | Rename, or create a new record |
| RevenueCat project / products | Product IDs are internal; can stay or be recreated |
| Bundle identifier | **Permanent once shipped** — nothing has shipped, so change it now (see D-005) |
| Repo, code, docs | Mechanical find-and-replace |
| Domain | Not yet purchased — no loss |
| Privacy / support pages | URLs change with the repo name |

The one thing that would have been expensive — shipping under the name and then
discovering this — did not happen.
