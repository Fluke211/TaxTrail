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
Scan a receipt, get the right IRS Schedule C line. No account, no cloud.
Your receipts never leave your phone.
```

Because this field updates without a review cycle, use it for seasonal pushes:
January "Tax season is here", April "Deadline in two weeks".

## Description

```
TaxTrail turns a photo of a receipt into a categorized, tax-ready expense,
without sending it anywhere.

Everything happens on your iPhone. The text recognition, the categorization, the
math. There is no account to create, no cloud to sync with, and no server that
receives your receipts. Your financial records stay yours.

SORTED FOR YOUR TAX RETURN
Every receipt is filed to one of 29 categories mapped to real IRS lines:
Schedule C, plus Schedule A, Form 8829, Form 4562, and cost of goods sold.
When a purchase is partly personal, split it: the sales tax splits with it.

BUILT FOR REAL RECEIPTS
Apple's document scanner finds the receipt's edges, flattens it, and sharpens
the print before anything is read, so faded thermal paper and crumpled corners
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

## What's New

**Version 1.0 has no such field.** App Store Connect shows "What's New in This
Version" only on an update, so there is nothing to paste for the first
submission. Keep the text below for 1.0.1.

```
First release. Scan receipts, get them filed to the right IRS line, export for
your accountant, all on your device.
```

## URLs

| Field | Value |
|---|---|
| Support URL | `https://taxtrail.app/support` |
| Privacy Policy URL | `https://taxtrail.app/privacy` |
| Marketing URL | optional — leave blank until there's a real site |
| Copyright | `2026 Tyler Thornbrue` — year and holder, no `(c)`; Apple renders the symbol |

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

Permissions the app requests:
- Camera — photographing receipts.
- Photo library — importing an existing receipt picture chosen by the user.
- Face ID — an optional app lock, off by default and turned on in Settings. It
  unlocks the app on this device only and authenticates against nothing.

The app requests no microphone and no location access. If you inspect the
Info.plist you will find no microphone key and no location key: the camera and
photo-picker integrations are configured with microphone access disabled, and
the local-network key that development tooling adds is stripped from any
non-Debug build.

To test Pro without purchasing, use the sandbox account provided, or note that
the free tier permits 10 scans per month with full parsing and CSV export.
```

**How the permission list was verified, 2026-11-07** (ours, not Apple's. Do not
paste the decision IDs to a reviewer, which is why they live out here):

- `expo-image-picker` and `expo-camera` both set `microphonePermission: false`,
  so no microphone key is generated (D-007).
- The local-network key `expo-dev-launcher` adds in development is stripped by
  a build phase in any non-Debug configuration (D-044).
- `expo-local-authentication` is a dependency and is used by
  `src/lib/appLockNative.ts`, so the Face ID line describes a real feature.
- `expo-location` is absent from `package.json` and unreferenced in `src/`, so
  no location key ships. The list is exactly three permissions.

> **Resolved: the block above is now correct for build 7.** This warning used
> to say that Face ID and Location must stay out of the notes until D-066 was
> decided, because build 4 carried purpose strings for both while no code
> imported either module. Describing features a reviewer cannot find is the
> fastest way to lose the benefit of everything else in these notes.
>
> D-066 was decided both ways, and the notes follow the outcome. **Face ID
> arrived**: `expo-local-authentication` is a real dependency, the lock is a
> Settings toggle gated in `App.tsx`, and Tyler confirmed it working on device
> on 2026-09-03, so it is disclosed above. **Location left**: build 7 dropped
> `expo-location`, which is what unblocked submission (D-085), so there is no
> location permission to disclose.
>
> The original mistake was checking `app.json` rather than the code: the plist
> and the notes agreed with each other and neither was compared with what the
> app does. The verification line above is written against `package.json`,
> `app.json` and `src/` together for that reason.

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

Six slots. **Read the accepted pixel sizes off the tab in App Store Connect
rather than from any guide, this file included.** Apple organises screenshots
by device class and states the sizes each tab takes, and it changed under us:
the 6.9-inch sizes are refused now and the iPhone tab asks for 1179x2556 or
1206x2622. Six uploads failed at once on the old size. The order matters more than the polish:

1. **Capture → parsed result.** The core loop in one image.
2. **The privacy claim, over the app.** This is the pitch; put it where people
   actually still swipe. **It no longer names competitors** (D-086) — see below.
3. **Category list**, showing real IRS line numbers. Proves depth.
4. **Summary by Schedule C line**, with a year total.
5. **Export sheet** — CSV, Excel, TXF, QuickBooks Online, archive.
6. **Receipt split**, showing tax-aware division.

Caption every one. Screenshots are read as a slideshow, not studied.

`tools/screenshots/` composes all six at the output size set by `OUT_W`/`OUT_H`
in `build.js` (1179x2556 today) from raw phone captures, so
this needs neither a Mac nor the simulator. Its README has the workflow.

### Slot 2 stopped being a competitor comparison (D-086)

It read "TaxTrail beside Keeper, QuickBooks, and Wave" for weeks. Two guidelines
say not to, both read rather than remembered:

- **2.3.3** "Screenshots should show the app in use, and not merely the title
  art, login page, or splash screen. They may also include text and image
  overlays." A slot that is only a comparison table is not the app in use.
- **2.3.7** "don't try to pack any of your metadata with trademarked terms,
  popular app names ..." Three competitors' marks in a screenshot is a
  reviewer's discretion at best, and it invites a complaint from the mark
  holders that has nothing to do with Apple.

And one reason that is not about rules: a claim about someone else's privacy
label is true only until they change it, which they can do without telling
anyone. The contrast survives. Every line in slot 2 is now a claim about **this**
app, which is verifiable, which Apple's own label already backs, and which stays
true.

## Copy accuracy — checked against the code 2026-08-29

Tyler's standing rule is to verify claims rather than inherit them. Every
number in the copy above was checked against what the app actually does:

| Claim | Reality | Verdict |
|---|---|---|
| "29 categories" | `CATEGORIES` holds 30; 29 of them are categories and the 30th is "Uncategorized", the absence of one | **Was "29", corrected to "28" in the 2026-08-29 pass, and back to "29" on 2026-10-20.** Not a reversal: the rule that pass set (Uncategorized is not a category) is the one applied here, and a category was added after it. `npm run test:cats` derives the number from the code now, so this cannot drift a third time |
| "10 scans a month" | `FREE_SCANS_PER_MONTH = 10` in `src/lib/config.ts`, and the boundary is unit-tested (D-043) | Accurate |
| "mapped to real IRS lines" | Schedule C, Schedule A, Form 8829, Form 4562, Part III COGS, all present. **27 of the 29 name a specific line, part or form**; the other two are "General Merchandise" (which says "Review — could be Supplies (L22) or Office (L18)") and "Personal (non-deductible)" | Accurate as written, since the claim is about the set. If you want it airtight, say "29 categories, 27 of them tied to a specific IRS line". Your call on the pitch, flagged rather than changed |
| "your receipts never leave your phone" | No analytics or ad dependency; the only URLs in `src/` are two `Linking.openURL` targets on the paywall | Accurate |
| "QuickBooks three-column CSV" | The format is QuickBooks **Online** only; Desktop cannot import bank CSV | **Corrected** — the old wording promised Desktop users something that cannot work |
| "Apple's document scanner ... multiple pages" | `react-native-document-scanner-plugin`, multi-page capture shipped in js r3 | Accurate |

### Settled: "Meals & Entertainment" was renamed (D-050)

This section used to ask Tyler to decide. The decision was made and shipped, so
it is recorded here rather than left looking open.

The label was a misnomer: entertainment has been nondeductible since the TCJA,
and the Schedule C instructions say twice "Do not include entertainment
expenses on this line", so the old name invited a user to file an entertainment
receipt into a 50%-deductible bucket. The category is **"Business Meals"** now,
and because the name is stored as a string on every saved receipt and inside
every allocation, the rename shipped with a migration map rather than as an
edit (`classifier.js`, `'Meals & Entertainment': 'Business Meals'`).

Nothing in the listing copy above names the category, so no listing text
changed with it.
## Creative assets (header and search results) are OPTIONAL

Tyler noticed the asset library offers a "header and search results" slot that
nothing had been uploaded to, and asked whether it was missing. It is not
required to submit.

Checked against Apple's own documentation on 2026-11-07, not a blog, because
the screenshot-size failure came from trusting an inherited number:

> Creative assets are optional and separate from your app's screenshots, app
> previews, In-App Purchase and Subscription images, and any promotional
> artwork requested by editorial teams.

The same page says they appear only on "iOS 27 or iPadOS 27 or later", so they
reach none of the installed base that matters at launch. **Screenshots remain
the required asset, and all six exist.**

Specifications, for whenever we do make them:

| Placement | Image | Video |
|---|---|---|
| Product page header | 21:9, 3840x1646, `.jpeg` `.jpg` `.png`, no alpha channel or transparency | 21:9, 3840x1646, 30 or 60 fps, 5 to 30 s, `.mov` `.m4v` `.mp4` |
| Search results | 3:2, min 1920x1280, max 3840x2560, `.jpeg` `.jpg` `.png` | same ratio and sizes, 30 or 60 fps, 5 to 30 s |

A 16:9 `.png` at 5244x2950 is listed under both placements. Apple's page does
not say it serves both, and the primary ratios differ, so do not assume one
file covers them until that is confirmed in App Store Connect itself.

Sources: Apple's [creative assets specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications/)
and [manage your App Store assets](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets).

---

## In-app purchase naming: what is locked and what is not

The products were created under the old name and read **RS Pro Monthly** and
**RS Pro Annual**. Three separate fields are involved and only one is
customer-facing. Apple's own wording, checked 2026-11-07:

| Field | Customer sees it | Editable |
|---|---|---|
| Product ID | No. StoreKit only | **Never.** "The product ID isn't editable after you save the In-App Purchase", and it "can't be reused for another In-App Purchase within the same app, even if you delete the original" |
| Reference Name | No. "not visible to customers, but used in App Store Connect and Sales and Trends reports" | Yes, "can be edited at any time without review". Up to 64 characters |
| Display Name | **Yes, on the store and in the purchase sheet** | Yes, but "changes to the localized information require review". 2 to 30 characters |

**The locked `RS` product IDs are harmless.** Verified against the code: `src/`
contains no product IDs at all, because `presentPaywall` renders
`offerings.current.availablePackages` from RevenueCat, which matches on product
ID internally. So a rename cannot break the offering and no user ever sees the
identifier.

**A stale Display Name is worth fixing before submitting, not after**, since the
change needs review either way: done now it rides along with this submission,
done later it costs a separate review round. "TaxTrail Pro Monthly" is 20
characters and "TaxTrail Pro Annual" is 19, both inside the limit.

Check both fields, because they are usually set to the same string at creation.

### The display names are already correct

"Pro Monthly" and "Pro Annual" need no change. The **subscription group**
display name was set to **"TaxTrail Pro"** on 2026-08-29, to fix a blocker where
the group had no localization and the products would not fetch. So a customer
reads "TaxTrail Pro" and then "Pro Annual" beneath it, which carries the brand
once rather than twice.

The group's reference name is still "ReceiptSnap Pro" and the product IDs are
still `receiptsnap_pro_*`. Both are internal, neither is editable in the case of
the IDs, and no customer sees either. Tyler changed the product reference names
from RS to TT on 2026-11-07, which needs no review.

## The third tier: lifetime EXISTS, and D-002 says it ships

Tyler asked whether lifetime had been dropped, remembering a decision to keep
to monthly and annual. **It was not dropped, and nothing supersedes D-002**,
which settled "Pro at $6.99/mo, $39.99/yr (7-day trial, highlighted default),
$99.99 lifetime" on 2026-08-01. Its reasoning: "Lifetime at ~2.5x annual limits
cannibalization and monetizes ad-averse privacy buyers."

**It already exists and is wired up.** `receiptsnap_pro_lifetime` ($99.99
non-consumable) was created 2026-08-02, is attached to the RevenueCat `pro`
entitlement, sits in the `default` offering as `$rc_lifetime`, and all three
products were verified fetchable and `READY_TO_SUBMIT` on 2026-08-29.

The reason it looks absent is structural: a non-consumable lives under **In-App
Purchases**, not **Subscriptions**, and this one is deliberately **outside** the
subscription group. Looking at the Subscriptions section shows two products, and
that is correct.

**What it has never had is a sandbox test.** The ROADMAP item covering monthly,
annual and the lifetime unlock is still open, and only monthly and annual are
confirmed working. That is the one real argument for deferring it, and it is
cheap to remove rather than live with, because a non-consumable grant is
permanent and cannot be undone per customer.

If it were ever pulled, nothing would break: the paywall renders whatever the
offering returns, and `DISPLAY_PRICES`, which carries the $99.99 string, has
exactly one reference in the whole app, its own definition. It is dead code and
displays nowhere.

**One real inaccuracy only if lifetime is pulled.**
`src/components/FallbackPaywall.tsx` ends its auto-renew disclosure with "The
lifetime option is a one-time purchase and does not renew." That line is inside
`{anyAutoRenewing && (...)}`, so it renders whenever any auto-renewing package
exists, whether or not a lifetime package does. Launching without lifetime
means that screen describes an option that is not there. It only appears when
RevenueCat's remote template fails, but the file's own comment is right that
"if it renders for a reviewer, it is the paywall", so the sentence should
become conditional on a non-renewing package being present.

---

## The RevenueCat paywall template must be fixed before review (D-107)

A screenshot of the live paywall, taken 2026-11-07, shows an app icon, the word
TaxTrail, three priced rows, Purchase and Restore. **Guideline 3.1.2 requires
more than that on the screen that offers a subscription**, and the template is
missing all of it:

| Required on the offer screen | Present? |
|---|---|
| Title of each subscription | Yes |
| Price | Yes |
| **Length of the period** | **No.** Rows read "$6.99", not "$6.99 per month" |
| **Auto-renewal disclosure** | **No** |
| **Link to Terms of Use / EULA** | **No** |
| **Link to a privacy policy** | **No** |

`FallbackPaywall.tsx` has every one of them, but it renders only when the
remote template throws, so it is not what a reviewer sees.

**The same edit should fix the selling, which is weak against D-002:**

- **Preselect annual, not monthly.** D-002 made annual the "highlighted
  default"; the template preselects Pro Monthly.
- **Say the trial exists.** D-002 specifies a 7-day trial on annual and the
  screen never mentions it.
- **Show the saving.** $39.99 a year against $6.99 a month is **52% off**, and
  the screen does not say so.
- **Say what Pro is.** The template gives no reason to buy. The unused fallback
  manages it in one line: "Unlimited scans, plus Excel, TXF and QuickBooks
  exports. Everything still stays on your device."

All of this is **dashboard configuration**: no build, no OTA, live immediately.
Which is the trap, because it also means it can be done after submitting, and it
must not be: the reviewer sees the template as configured at review time.

---

## RevenueCat paywall: what to put in the editor (D-107)

Paste-ready content for the fixes D-107 calls for. **Check first whether the
paywall is v1 or v2**, because the variable names differ: v2 prefixes them with
`product.`, v1 does not (`sub_offer_duration` is a v1 name). Everything below is
v2, which is what RevenueCat's current documentation uses.

### Title and subtitle

    TaxTrail Pro

    Unlimited scans, plus Excel, TXF and QuickBooks exports.
    Everything still stays on your device.

That subtitle is lifted from `FallbackPaywall.tsx`, which has always had a
reason to buy where the live template has none. The second sentence is the
differentiator and should not be cut.

### Feature list (a v2 component)

    Unlimited receipt scans
    Excel, TXF and QuickBooks Online exports
    Full archive, every receipt image included
    Still 100% on device. No account, no cloud

### Package rows: use a variable, not a typed price

The rows currently read "$6.99", which states no period and is the 3.1.2
failure. RevenueCat's own App Review guidance says to use
`{{ product.price_per_period }}` or `{{ product.price_per_period_abbreviated }}`,
and warns that `product.price_per_month` or `product.price` alone "may not
satisfy this requirement".

| Row | Price field |
|---|---|
| Pro Monthly | `{{ product.price_per_period }}` renders `$6.99/month` |
| Pro Annual | `{{ product.price_per_period }}` renders `$39.99/year` |
| Pro Lifetime | `{{ product.price }}`. Period variables return "lifetime" for a non-consumable, so a period reads oddly here |

### Preselect ANNUAL, and badge it

D-002 made annual the "highlighted default" and the template preselects
monthly, which steers buyers to the lower-value plan. Set annual as the
selected package in the Package component.

Badge it **Save 52%**, which is arithmetic, not marketing: $39.99 against
12 x $6.99 = $83.88 is a 52.3% saving. A "$3.33 a month, billed annually" line
is also true and reads well, but the **full billed amount must still appear**,
because RevenueCat's guidance is explicit that a normalized monthly price alone
is not enough.

### The free trial: VERIFY IT EXISTS BEFORE ADVERTISING IT

D-002 specifies a 7-day trial on annual, and the ROADMAP records
`receiptsnap_pro_annual` as having one. The live paywall never mentions it.
**Confirm the introductory offer is actually configured on the annual product
in App Store Connect before putting it on the paywall**: offer variables fall
back to ordinary pricing when there is no offer or the customer is not
eligible, so a trial advertised but not configured is a false claim on the
offer screen, which is worse than not mentioning it.

If it is configured, use `{{ product.offer_price }}` and
`{{ product.offer_period }}`, and a call to action of "Start 7 days free".

### The Footer: this is the part that fixes the rejection

Add a **Footer** component, "a configurable portion at the bottom of the screen
whose position can be fixed", holding the disclosure text and the links.

Disclosure text, adapted from `FallbackPaywall.tsx` and keeping "Cancel
anytime", which RevenueCat's App Review page names specifically:

    Subscriptions renew automatically unless auto-renew is turned off at least
    24 hours before the end of the current period. Your account is charged for
    renewal within 24 hours of the end of the current period. Cancel anytime in
    your Apple ID settings. Pro Lifetime is a one-time purchase and does not
    renew.

Links, using **Button** components. The documentation describes a Button as
used for "a link to your Privacy Policy" but gives no setup steps, so the exact
control has to be found in the editor. These are the project's canonical URLs,
already in `FallbackPaywall.tsx`:

| Link | URL |
|---|---|
| Terms of Use | `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` |
| Privacy Policy | `https://taxtrail.app/privacy` |

A **Restore Purchases** control must also be present. The live paywall already
shows one, so this is only a matter of keeping it.

### Then run RevenueCat's own audit

The editor has an AI audit that checks a paywall for problems including "a
missing restore purchases link". Run it after editing: it is free and it checks
the artifact rather than the intention, which is the whole lesson of D-107.

### Not verified here

Apple's required elements and the variable names above come from RevenueCat's
documentation. **How to set the preselected package, and the exact control for
a Restore button, are not in the documentation** and have to be found in the
editor UI. Do not take the steps above as a click path.

---

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
- [x] Production build (`channel: production`) — the dev-only update button
      disappears automatically (D-019). Build 7 is the newest live binary,
      `test:publishable` agrees, and Tyler has run r43 through r49 over the air
      on build 7, so the OTA chain is proved on the exact binary under review
- [x] Screenshots at required sizes — **six built at 1179x2556** (D-106), and
      **uploaded 2026-11-07**. The 6.9-inch sizes this repo recorded were
      refused; read the size off the iPhone tab
- [x] App Review notes pasted 2026-11-07, with Face ID disclosed. Verified
      against commit `88a5061` (build 7): `expo-local-authentication` is a
      dependency there, `appLockNative.ts` ships, the purpose string is in
      `app.json` and Settings references it, and `expo-location` is absent.
      The notes describe the binary a reviewer actually runs
- [x] **Age rating completed 2026-11-06** (Tyler) — the TestFlight purchase sheet renders the app
      as "UNRATED" until this is done, and Apple will not accept a submission
      without it. App Store → the app → Age Rating → Edit; every answer is
      "None" for this app
- [x] Export compliance — `ITSAppUsesNonExemptEncryption: false` is set in
      `app.json`, confirmed 2026-11-07, so App Store Connect should not ask at
      all. If it ever does, the answer is No
- [x] **App Store Small Business Program enrolled** — Tyler confirmed acceptance
      2026-11-06. 15% instead of 30%. It is not retroactive, which is why it
      had to land before the first sale; it has, so this is closed
- [x] **Paid Applications agreement active.** Tyler checked 2026-11-07 and it
      had **lapsed**, showing out of date that morning; he reactivated it. Worth
      the check: `src/lib/purchases.ts` falls back to
      `Alert.alert('Purchases not configured', 'TaxTrail Pro is unavailable in
      this build.')` when RevenueCat has no products, so a reviewer who tapped
      Upgrade would have read exactly that, which is Guideline 2.1
- [ ] **"Add for Review" on each Pro product.** THE STOP-SHIP ITEM. The three
      products sat at **Prepare for Submission** on 2026-11-07, which Apple
      defines as: "Your In-App Purchase has been created, but you haven't yet
      submitted it for review. Use Add for Review to add it to a submission."
      So the status does NOT mean metadata is missing, it means the products are
      attached to no submission. **Submitting the version while they sit there
      ships an app whose paywall cannot work.** Each must reach **Ready for
      Review**, which Apple defines as "added to a submission, but you haven't
      sent the submission to App Review yet"
- [ ] **A real App Review screenshot on each subscription.** It was a black
      placeholder on 2026-11-07. Apple requires "a screenshot of the In-App
      Purchase that clearly shows the item or service being offered", so a black
      image fails the requirement as written. Two things make this easy to get
      wrong:
      - The size. Apple says "upload a screenshot that meets any of the
        screenshot specifications your app supports", and a raw iPhone 14 grab
        is 1170x2532, which App Store Connect refuses, exactly as it refused the
        marketing slides. Run the capture through
        `node tools/screenshots/review-shot.js <grab.png>`, which resizes to
        1179x2556 by scaling to width and padding, so no pixel a reviewer reads
        is stretched. Do NOT use `build.js`, which adds a marketing caption.
      - It cannot be undone. "Once you've uploaded a screenshot, you can update
        it but not remove it." Replacing the placeholder is fine; deleting it is
        not possible
- [x] **Retention messages and the 1024x1024 promotional image are NOT needed.**
      Apple: an image "is required if you want to promote your In-App Purchase
      on your App Store product page or set up win-back offers." We want
      neither, so both are skipped deliberately rather than left undone
- [ ] **Review notes on each subscription** (optional, 4000 character limit).
      Apple describes them as "additional information about the In-App Purchase
      that might help Apple review the submission". Worth one line telling the
      reviewer where the paywall is, since it sits behind a scan limit
- [x] **Manual release selected** 2026-11-07, so the listing can be checked
      before it is public
