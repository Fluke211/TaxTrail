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

## A v2 paywall draft is BUILT and waiting for Tyler to publish (rev 10)

Built through the v2 API on 2026-11-07, after Tyler chose migration over
patching the legacy paywall. **Paywall `pw582c296e2dea4c0b`, revision 2,
`published_at: null`.**

| What | State |
|---|---|
| Packages | `$rc_annual` (selected by default), `$rc_monthly`, `$rc_lifetime` |
| Terms of Use | `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` |
| Privacy Policy | `https://taxtrail.app/privacy` |
| Auto-renewal disclosure | present, in the sticky footer, ending "Pro Lifetime is a one-time purchase and does not renew" |
| Restore Purchases | present (the template ships it) |
| Price with period | `{{ product.price_per_period_abbreviated }}`, plus `{{ product.relative_discount }} OFF` on annual |
| Title | TaxTrail Pro |

**Three things the generated template got wrong and that had to be fixed**, none
of which would have been obvious without reading the JSON:

1. **Its Terms and Privacy buttons pointed at `revenuecat.com/terms` and
   `revenuecat.com/privacy`.** Shipping that is worse than having no links.
2. **It carried only two packages.** `$rc_lifetime` was absent, so publishing
   it unaltered would have silently dropped the tier D-002 settled and Tyler
   had just reconfirmed. Added by cloning the monthly package component, with
   fresh component ids and its own localizations.
3. **It was full of "Cat.io" placeholder copy and a stock cat photograph**
   (`assets.pawwalls.com`). The image was item 0 of an `[image, text, text]`
   hero block and was removed outright rather than replaced.

The template did get two things right that the legacy paywall had wrong:
`$rc_annual` already carried `is_selected_by_default: true`, matching D-002,
and it uses period-bearing price variables.

### Round two, after RevenueCat's AI audit (revision 3)

The audit passed every App Store compliance row, including Auto-Renewal
Disclosed and Terms & Privacy Accessible, which is the thing D-107 was raised
about. Its remaining findings were layout and conversion, and these are fixed:

| Audit finding | Fix |
|---|---|
| "The Lifetime card is cut off. Three cards side by side don't fit on a 402px phone" | The plan container was `horizontal`. It is `vertical` now, so each plan is a full-width row |
| "Two near-identical purples" and "the button doesn't stand out" | 20 colour values swapped to the app's own accent, `#2f5ae0` from `theme.ts`, so there is ONE accent and the filled button is the only solid element |
| "Too many font sizes. There are seven" (eight, in fact) | 34 / 15 / 12 / 16 only. 20 and 17 collapsed to 16, 13 and 11 to 12 |
| "The subtitle is too loud... and repeats the benefits listed right below it" | One line at 16pt, "For the receipts your tax return depends on.", which says something the feature list does not |
| "Weak intro-offer subtitle... Our most advanced features, for our most dedicated users" | A leftover Cat.io string missed on the first pass. Now matches the default subtitle |
| "Repeated price on Monthly. Billed at $9.99/mo. repeats the price shown right above it" | Reads "Cancel anytime." |
| "The footer hides your benefits" | The legal block is 205 characters, down from 320, still stating auto-renewal, how to cancel and the lifetime exception |
| "App name mismatch... the screen is named ReceiptSnap" | The paywall's `name` is "TaxTrail Pro" now |

**Two audit findings were NOT acted on, deliberately:**

- **"Apple-only wording. The legal text says Apple ID. That's wrong if this
  paywall also runs on Android."** It does not. TaxTrail is an iOS app, min iOS
  15.1, with no Android target, so "Apple ID" is correct and the generic advice
  does not apply.
- **iPad and landscape adaptation.** Real, but out of scope for a submission
  that is about compliance. Worth revisiting if the app is ever promoted for
  iPad.

**The preview's prices are placeholders.** It rendered $69.99, $9.99 and
$119.99 with "19% OFF", against the real $39.99, $6.99 and $99.99. RevenueCat's
documentation says the editor substitutes real prices "as soon as pricing data
is available", so this is preview behaviour rather than misconfiguration.
Confirm on device all the same, because the alternative explanation, products
not fetching, would be serious.

**Attaching an unpublished paywall does not disturb the live one.** Tyler
confirmed on device that the app still renders the legacy paywall after the
offering's `paywall_id` was set. That answers the question the previous section
left open: the legacy paywall keeps serving until the v2 one is published.

The offering's `display_name` is still "ReceiptSnap Default". A PATCH to the
offerings endpoint returns **405**, so it cannot be renamed through the API. It
is internal and no customer sees it.

### Round three: the footer was eating the screen (revision 4)

Compliance passed again, on every row. The audit's remaining complaint, which
Tyler had already spotted himself ("It's covering up the benefits of
subscribing... those subscribe boxes could probably be shrank"), was that the
sticky footer took about 60% of the screen and hid two of the five benefits,
including "Still 100% on device", which is the strongest thing the app has to
say.

| Change | From | To |
|---|---|---|
| Plan card vertical padding | 12 | 8 |
| Plan card inner spacing | 8 | 3 |
| Gap between plans | 8 | 6 |
| Footer spacing | 12 | 8 |
| Footer top padding | 16 | 10 |
| Annual resting background | `#f2f2f7ff`, same as the others | `#2f5ae026`, so it reads as recommended BEFORE it is selected |
| Badge | "{{ product.relative_discount }} OFF" | "SAVE {{ product.relative_discount }}" |
| Per-month line | 12pt grey, identical to "Cancel anytime" | 12pt semibold in the accent blue |
| Call to action | "Continue" | "Unlock unlimited scans" |

**The legal block was deliberately NOT moved into the scrolling area**, which
is what the audit recommended for space. Guideline 3.1.2 wants the disclosure
on the screen that offers the subscription, and a reviewer who does not scroll
is exactly the case the rule exists for. Trading a certain compliance position
for a probable conversion gain is the wrong way round on a submission that is
already blocked on compliance. The space came out of the cards instead, which
is where the audit itself said most of it was. If more room is needed later,
moving it is a conversion decision to take after approval, not before.

**The audit's "the paywall itself is named ReceiptSnap" is stale.** The API
reports `name: "TaxTrail Pro"` as of revision 3. What is still called
ReceiptSnap is the OFFERING's `display_name`, which no customer sees and which
the API will not rename (PATCH returns 405).

Not acted on, again: tablet and foldable layouts, and the free-trial text
variants that repeat the default wording. Both are real and neither blocks
submission.

### Round four: reorder beats shrink (revision 5)

Revision 4 surfaced three benefits instead of two. Tyler: "Almost. Still
blocking some." Benefits four and five were still under the fold.

About 84 more vertical pixels came out: the close-button row's top margin 16 to
8, the headline 34 to 30, the benefits card's margins 16 to 8 and padding 12 to
10, each of the five benefit rows 8 to 4, and the plan cards 8 to 6.

**But the change that actually matters is the reorder.** Squeezing pixels to
reveal a fifth row is a losing race on a small phone; putting the right row
third is not. "Still 100% on device" was written fifth and is the strongest
thing this product can say, so it is third now:

1. Unlimited receipt scans
2. Every export format
3. **Still 100% on device**
4. Full archive, images included
5. 29 categories, real IRS lines

The two that can still fall below the fold are the two that cost least when
they do. The ordering question had been sitting underneath the layout question
for three rounds, and no amount of padding would have answered it.

### Round five, and where the tuning stops (revision 6)

All five benefit titles were visible; only the fifth description wrapped below
the fold. Tyler asked for the white space above the title to be used: "Just
shift everything up, right?"

Not quite, and the reason is worth recording. That gap is **the close-button
row's own height**, not padding. The row is a vertical stack aligned trailing,
so the X sits right while the rest of the row stays empty, and a vertical stack
cannot put the headline alongside it. Only the 8px margin above the row was
actually free.

So: close-row top margin 8 to 0, benefits card top margin 8 to 6, and the fifth
description from 63 characters to 44, "Schedule C, Schedule A, 8829, 4562 and
COGS.", which is one line instead of two.

**The close button was deliberately NOT shrunk.** Its icon is 28px with 4px of
padding, about a 36px tap target, already under Apple's 44pt guidance. Buying a
line of text by making an undersized control smaller is the wrong trade. It is
worth ENLARGING after launch, which costs vertical space, so it is a post-
approval item rather than a pre-submission one.

**This is where the tuning should stop.** Five rounds in, every compliance row
passes, all five benefit titles are visible and the ordering puts the privacy
line third. Further rounds trade real time against diminishing returns on a
screen that is already approvable.

### The final copy (revision 7)

Tyler shortened the fourth description himself, from "Every receipt photo
beside the data, the copies the IRS expects." to "Every receipt photo the IRS
expects.", 64 characters to 36. Nothing is lost: "beside the data" was already
carried by the title above it, "Full archive, images included".

The five benefits as they now stand, every description on one line:

| | Title | Description |
|---|---|---|
| 1 | Unlimited receipt scans | No monthly cap. Scan every receipt you get. |
| 2 | Every export format | Excel, TXF for tax software, and QuickBooks Online. |
| 3 | **Still 100% on device** | No account, no cloud, no trackers. Ever. |
| 4 | Full archive, images included | Every receipt photo the IRS expects. |
| 5 | 29 categories, real IRS lines | Schedule C, Schedule A, 8829, 4562 and COGS. |

Compliance re-verified after seven rounds of edits: the disclosure is present,
Terms points at Apple's standard EULA, Privacy at `taxtrail.app/privacy`, and
all three packages are attached.

### The plan cards: two rows, not three (revision 8)

Tyler asked whether the blank middle of each plan card could be used, or
whether that is "a pretty standard look we shouldn't mess with". Both, as it
turned out.

The card was already a horizontal row: a text column on the left and the radio
on the right, with `space_between` pushing them apart, so the gap in the middle
is inherent to that arrangement rather than wasted padding. But the PRICE did
not have to sit under the title. Moving it into that gap, right-aligned beside
the radio, is a standard plan-picker pattern and turns each card from three
rows into two.

Before and after, per card:

    Annual                        Annual                  $69.99/yr  (o)
    $69.99/yr          ->         Only $5.83/mo
    Only $5.83/mo

That is roughly 18px a card, 54px over the three, which is where the whitespace
under the benefits box comes from: the sticky footer shrinks, so the scrolling
area above it grows.

Checked afterwards, because a restructure can silently drop things a text diff
would not show: the annual badge survives on annual and does not appear on the
other two, all three prices are still bound to their variables, and the
disclosure and all three packages are intact.

### Revisions 9 and 10: two goes at one layout rule

Moving the price beside the radio in revision 8 introduced a defect and
overshot the space it was meant to free. Both are fixed.

**The prices did not line up.** Each price was `width: fit` and sat as the
MIDDLE child of a `space_between` row, so its position was decided by its own
text width and the width of the title column beside it. Three different
titles and three different prices therefore produced three different
positions, visibly ragged. The price is `width: fill` now, with
`horizontal_alignment: trailing`, so each one expands into the leftover space
and renders hard against the same right edge, just inside the radio. Identical
on all three cards, checked rather than assumed.

That is the risk of a restructure that cannot be previewed: the markup was
correct, the layout rule was not, and only looking at it showed the difference.

**And it freed more room than was wanted.** The gap under the benefits box went
from too little to too much. About 30 of the 54 reclaimed pixels are given back
(benefit rows 4 to 6, benefits card padding 10 to 12, plan cards 6 to 7), which
leaves a deliberate gap rather than closing it: a little whitespace under that
box is what was asked for in the first place.

### Revision 10: the fix that broke the other column

Revision 9 aligned the prices by giving each one `width: fill`. It worked, and
it introduced the opposite defect: a `fill` child claims all the slack in the
row, so the title column was squeezed to its minimum and its second line
wrapped. "Only $5.83/mo" became "Only / $5.83/mo", "Cancel anytime." became
"Cancel / anytime.", and the lifetime line took two lines as well. The cards
grew instead of shrinking.

**Only one child of that row can take the slack**, and it should be the column
with the long text, not the price. So it is inverted: the LEFT column is `fill`
and the price is back to `fit` with trailing alignment. The column absorbs the
variance, the price keeps its natural width, and because the column always
ends at the same place the price still lands hard against the radio on every
card. Both properties at once, where revision 9 traded one for the other.

Three attempts at one row (8, 9, 10), each correct about the thing it was
aiming at and wrong about what it displaced. That is the cost of editing a
layout that cannot be previewed from here, and it is the practical shape of
what D-107 states as a principle.

### Creating it attached it to the offering

`POST /paywalls` requires `offering_id`, and the offering's `paywall_id` went
from `null` to `pw582c296e2dea4c0b` immediately, while `published_at` stayed
null. **What the app serves in that state was not verified from here** and has
to be checked on the device. If the paywall fails to load, `FallbackPaywall`
renders, and that one is compliant, so the downside is cosmetic rather than a
rejection risk.

### What was NOT done, deliberately

**It is not published.** Publishing is outward-facing and the whole lesson of
D-107 is that a remote-configured screen has to be judged by looking at the
artifact. This draft was assembled from JSON by something that cannot see it
render, so it must be previewed in the dashboard, run through RevenueCat's AI
audit, and published by a person. The screenshot for App Review has to be
retaken afterwards, because the current one shows the legacy paywall.

---

## RevenueCat paywall: what to put in the editor (D-107)

**This paywall is a LEGACY (v1) paywall.** Established against the API on
2026-11-07, not inferred:

    GET /v2/projects/proj63a7fa32/paywalls            -> 0 items
    GET /v2/projects/proj63a7fa32/offerings/ofrng6092a617e4
                                                      -> paywall_id: null

and yet the app renders a RevenueCat paywall, which is not `FallbackPaywall`
(that one has a subtitle, legal text, Terms and Privacy links and a "Not now"
button, and renders no app icon). So a paywall exists and the v2 API cannot see
it, which is what a legacy paywall looks like from v2.

**Consequences, both of which bite:**

1. **The v2 variable names do not work here.** v2 writes
   `{{ product.price_per_period }}`; v1 writes `{{ price_per_period }}` with no
   prefix. A v2 name on a v1 paywall renders as literal text on a live screen.
2. **A legacy paywall has no Footer component.** v2 has a `sticky_footer`,
   which is exactly where the auto-renewal disclosure and the Terms and Privacy
   links belong. On v1 the configurable fields are Title, Subtitle, Package
   details, Package details for an introductory offer, Call to action, and Call
   to action for an introductory offer. The disclosure has to be squeezed into
   one of those.

The offering is `ofrng6092a617e4` (`default`, display name still "ReceiptSnap
Default", internal only) and it carries all three packages: `$rc_annual`,
`$rc_monthly`, `$rc_lifetime`. So lifetime is live in the offering, which the
paywall screenshot confirms.

### Legacy (v1) variable names, if the legacy paywall is kept

| Need | v1 variable |
|---|---|
| Price with its period | `{{ price_per_period }}` or `{{ price_per_period_full }}` |
| Full billed amount plus monthly equivalent | `{{ total_price_and_per_month }}` |
| Saving against the monthly plan | `{{ sub_relative_discount }}`, which computes it rather than hardcoding 52% |
| Trial length | `{{ sub_offer_duration }}` |
| Trial price | `{{ sub_offer_price }}` |

Terms and Privacy on a legacy paywall: the documentation says components such
as "Terms of Service" and "Privacy Policy" are localized automatically, and the
only documented way to put a link in a string is Markdown,
`[Terms of Use](https://...)`. It does not confirm Markdown is the right
mechanism for the legal links, so that needs checking in the editor.

### The v2 content below is kept for a migration

Everything from here down assumes v2 and does NOT apply to the paywall as it
stands today.

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
