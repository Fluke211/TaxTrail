# Decisions

Durable record of *why* things are the way they are. Read this before
re-litigating something — most of these cost real time to establish.

Each entry: what was decided, when, why, and what would change it.

> **Claiming an ID:** more than one session can be working in this repo at once.
> Before adding an entry, `git fetch origin main` and take the next unused
> number. If two sessions collide anyway, the later merge renumbers itself and
> fixes any cross-references — IDs are cited from `ROADMAP.md`, `STATUS.md`, and
> `docs/RUNBOOK.md`.

---

## D-001 · No ads, ever — especially not OCR-derived targeting

**2026-08-01 · Settled**

Receipt-keyword-targeted advertising is technically trivial
(`react-native-google-mobile-ads` accepts per-request `keywords[]`) and
commercially wrong.

- A retained free user generates **$0.25–0.70/year** from ads at realistic US
  iOS eCPMs. The subscription funnel implies **$0.68–1.70 per free user** at
  median conversion. Ads earn 2–5x less.
- Anything *derived* from on-device data and sent off-device must be declared.
  OCR keywords would flip the App Store label from **"Data Not Collected"** —
  the app's core differentiator — to a multi-category advertising disclosure.
- It would require an ATT prompt in an app whose subtitle is "your data never
  leaves your phone."
- The FTC's Avast settlement ($16.5M) is precisely this fact pattern. Receipts
  contain pharmacy items (health data), alcohol, and embedded PII.

**Would change it:** nothing short of abandoning the privacy positioning
entirely, which is the whole business.

Full analysis: `MARKET_AND_GTM_STRATEGY.md` §4.

---

## D-002 · Subscription pricing

**2026-08-01 · Settled, not yet implemented**

Pro at **$6.99/mo**, **$39.99/yr** (7-day trial, highlighted default),
**$99.99 lifetime**. Free tier: 10 scans/month with full parsing + CSV export.

Higher-priced apps out-convert lower-priced ones (D35 2.7% vs 1.5%) with ~6x
LTV per payer. $39.99/yr undercuts every credible competitor's annual. Lifetime
at ~2.5x annual limits cannibalization and monetizes ad-averse privacy buyers.
10 free scans/month lets a hobbyist live free — they were never buyers — while
any real business hits the wall in week one, exactly when they've seen the
product work.

Enroll in the App Store Small Business Program (15%) at launch.

**Would change it:** sustained conversion above 4% argues for raising annual to
$49.99. Test via RevenueCat paywalls, which are remote-configurable.

---

## D-003 · EAS CLI work runs in GitHub Actions, not a Codespace

**2026-08-02 · Settled**

Claude Code remote sessions get a gateway 403 on every Expo domain —
`api.expo.dev`, `expo.dev`, `u.expo.dev`, `exp.host`, `cdn.expo.dev`. Verified
directly; the proxy status endpoint reports `connect_rejected` / policy denial.
It is not a misconfiguration and cannot be worked around.

Actions runners have unrestricted network access, and runs can be dispatched
and their logs read through the GitHub API. That lets an agent drive the entire
EAS pipeline while Tyler — usually iPhone-only — only taps in a browser.

**Consequence:** `.github/workflows/eas.yml` is the primary EAS interface. The
Codespace remains for the one thing CI cannot do (below).

---

## D-004 · Apple credentials are set up interactively, once

**2026-08-02 · Settled**

Verified against eas-cli 21.4.0: neither `eas credentials` nor
`eas credentials:configure-build` accepts `--non-interactive`. Certificate and
provisioning-profile creation requires authenticating to Apple.

The App Store Connect API key exists to substitute for that human — but the
`.p8` download **fails on iOS**, in both Safari and Chrome, in both desktop and
mobile modes. That appears to be a platform limitation, not a settings problem.

So credentials were created by signing in to Apple directly from a Codespace
terminal. `credentials:configure-build` stores the results on Expo's servers,
so CI builds run `--non-interactive` against them afterward.

**Current credentials:** distribution certificate and ad-hoc provisioning
profile, Apple Team `5M67JT29GJ`, both valid until **31 May 2027**. Provisioned
device: iPhone `00008110-000969302ED3A01E`.

**Would change it:** they expire May 2027, or a new test device is added. Either
means another interactive trip. If the `.p8` download ever works, an ASC API key
would remove the need entirely.

---

## D-005 · Bundle identifier `com.tylerthornbrue.receiptsnap`

**2026-08-02 · Settled, permanent**

Was `com.vaultvision.receiptsnap`, which implied ReceiptSnap is a VaultVision
sub-product and would strand the identifier if that brand were renamed or
retired.

A bundle ID is permanent once an app ships — changing it later means a new App
Store record and the loss of reviews and rankings. Changed while nothing was
registered with Apple and RevenueCat was unconfigured, so it cost one line.

`com.tylerthornbrue.*` is a namespace, not a brand: future apps slot in without
another decision like this. Shipped apps keep whatever ID they have, so
incorporating later doesn't create a problem.

**Note:** `setup-receiptsnap-mobile.sh` still emits the old identifier. It is
left byte-unchanged per the project guardrail; `mobile/` is authoritative.

---

## D-006 · Native dependencies front-loaded into the dev build

**2026-08-02 · Settled**

A development client can only exercise native modules compiled into it. The
production build is a separate future build regardless — that's where the
surface gets trimmed — so the dev client is deliberately generous.

Added: `react-native-document-scanner-plugin`, `expo-camera`,
`expo-local-authentication`, `expo-print`, `expo-haptics`, `expo-location`.

`expo-notifications` was in this set and then **removed** — it injects the
`aps-environment` entitlement, which broke signing against a provisioning
profile created before it (D-011). It is not needed until the Nov–Dec reminders
work, which coincides with the production build's fresh credentials.

**The document scanner is the important one.** The OCR engine is already Apple
Vision and cannot be improved on. What limits accuracy is the *image* handed to
it — a raw photo of an angled, curled receipt is the real bottleneck. VisionKit
gives automatic edge detection, perspective correction, and contrast
enhancement, plus multi-page capture for long receipts a single frame can't
hold. Verified New-Architecture compatible before adding (ships `codegenConfig`
and a TurboModule implementation).

**Rejected:** `react-native-vision-camera` (pulls nitro-modules peers; the
document scanner covers the need), `expo-media-library` (image-picker already
imports photos; adds a broad permission for nothing), `expo-secure-store` (no
account, no tokens), `reanimated`/`gesture-handler` (deliberately minimal native
surface).

**Correction to the GTM plan:** mileage is listed there as OTA-shippable. True
for a manual odometer log; **false for GPS tracking**, which needs
`expo-location` compiled in.

---

## D-007 · Permission surface is deliberately minimal

**2026-08-02 · Settled**

Verified by inspecting the prebuilt `Info.plist` rather than trusting plugin
defaults. The first prebuild silently added a **microphone** request
(`expo-image-picker` adds one by default) and **two always-on location** keys,
all with Expo's boilerplate text.

For an app whose differentiator is the "Data Not Collected" label, an
unexplained permission is corrosive. All three are now explicitly disabled, and
every remaining string states that processing happens on-device.

Shipping surface: camera, Face ID, photo library, when-in-use location.
`NSLocalNetworkUsageDescription` appears in dev builds only (Expo Dev Launcher)
and is absent from production.

**Rule going forward:** after any config-plugin change, re-inspect the generated
`Info.plist`. Plugins add permissions without asking.

---

## D-008 · Version-stamp discipline

**Standing rule**

Every deliverable carries a visible version. The PWA shows it on the home
screen; the Expo app shows it in the Summary footer via `src/lib/version.ts`.

- `JS_REVISION` — bump on every OTA update
- `APP_BUILD` — bump on every native build
- Always tell Tyler which version he's being handed

Without this, there is no way to tell which code is actually running on the
device, and parser debugging becomes guesswork.

---

## D-009 · No navigation library

**Inherited · Standing**

Custom 3-tab shell in `App.tsx`. Deliberate, to minimize native surface for the
single dev build. Every native addition requires a new build.

**Would change it:** enough screens that hand-rolled navigation becomes the
bigger cost. Not yet.

---

## D-010 · XLSX via SheetJS, not exceljs

**Inherited · Settled**

`xlsx@0.18.5` is pure JS and Hermes-safe. **exceljs does not work in React
Native** — it hangs at splash. Don't retry it.

---

## D-011 · Entitlements invalidate an existing provisioning profile

**2026-08-02 · Learned the expensive way**

The first EAS build failed at code signing:

```
Provisioning profile "*[expo] com.tylerthornbrue.receiptsnap AdHoc ..."
doesn't include the Push Notifications capability.
... doesn't include the aps-environment entitlement.
```

`expo-notifications` injects `aps-environment` into the entitlements. The
provisioning profile had been created ~40 minutes earlier, before that module
was added, so it carried no Push Notifications capability and Xcode refused to
sign.

There is no config escape. The plugin sets the entitlement unconditionally:

```js
withEntitlementsPlist(config, (config) => {
  if (!config.modResults['aps-environment']) {
    config.modResults['aps-environment'] = mode;
```

Any falsy override is simply overwritten. `expo-notifications` cannot exist
without the push entitlement, and local-only notification use doesn't change
that.

**Rule going forward:** adding a module that carries an entitlement invalidates
existing credentials. Capability changes need Apple authentication to sync, which
CI cannot do (D-004). So decide the entitlement-bearing module set *before*
generating credentials, not after — and preflight cannot catch this, because
`expo prebuild` succeeds fine; only signing fails.

---

## D-012 · RevenueCat dashboard config is API-driven from Atlas; restore behavior "Transfer if there are no active subscriptions"; no webhook

**2026-08-02 · Settled**

- Project **`proj63a7fa32`** was created via the RevenueCat MCP (OAuth-authed,
  the same Atlas session driving VaultVision's T-020 config), and the rest of
  the dashboard/store configuration runs the same way in checkpointed stages.
  Only steps with genuinely no API fall to Tyler's browser — restore behavior
  was one (done).
- **Restore behavior: "Transfer if there are no active subscriptions"**, with a
  deliberate nuance: `receiptsnap_pro_lifetime` will be a **non-consumable**,
  and a non-consumable is not an "active subscription" — so under this setting
  the lifetime unlock **transfers** between App User IDs on restore rather than
  duplicating. That is the intended behavior for a device-migrating owner.
- **No webhook integration will be created.** There is no backend, by design
  (the privacy positioning — everything on-device). The SDK's client-side
  entitlement checks are sufficient; a webhook can be added later without
  touching any of this config.

**Would change it:** building a backend (not planned; would contradict the
"Data Not Collected" label that is the product's differentiator).

---

## D-013 · App Store name: "ReceiptSnap: Expense Organizer"

**2026-08-02 · Settled**

- Plain "ReceiptSnap" — and several permutations — were already taken
  storewide. The ASC app record was created as **"ReceiptSnap: Expense
  Organizer"** (30-char limit respected), bundle `com.tylerthornbrue.receiptsnap`
  (D-005), iOS.
- The store name is changeable at any later version submission; the
  home-screen display name comes from the build (`app.json`), not this field —
  so the on-device branding stays "ReceiptSnap" regardless.

**Would change it:** a better name freeing up before first submission.

---

## D-014 · The dev client loads JS from EAS Update, not a dev server

**2026-08-02 · Settled**

The dev client's launcher wants a Metro dev server URL. We don't use one.

A dev server has to keep running somewhere the phone can reach. Claude Code
sessions can't host it (Expo domains blocked, container is ephemeral), and from
a Codespace it means babysitting a terminal on a phone while testing. Fragile
in exactly the situation where you want to be paying attention to the app.

Instead, publish the JS bundle to the `development` channel with `eas update`.
The client lists published updates and launches them — no server, nothing to
keep alive, and it works offline once fetched. The binary already carries
`https://u.expo.dev/d98a6958-...` from `update:configure`, and the development
build profile sets `channel: development`, so the two match.

`runtimeVersion` policy is `appVersion` (1.0.0), so updates only load into a
build with the same app version. Bumping `version` in `app.json` therefore
orphans existing installs from new updates — that is the intended safety
behaviour, not a bug.

Dispatched via the workflow's `update` step.

**Would change it:** heavy interactive iteration where live reload genuinely
pays for itself. Then a Codespace dev server with `--tunnel` is still available.

---

## D-015 · Real EAS quota, measured

**2026-08-02 · Corrects an earlier estimate**

The GTM doc's "free tier: 15 iOS builds/mo" was wrong. From the billing page:

- **30 total builds/month**
- **10 waived builds/month** — failed builds are waived rather than charged
- 10 uploaded builds/month, 1,000 MAU, 100 GiB edge bandwidth

The first signing failure cost nothing because it was waived. The waiver pool is
account-wide, and stood at 6/10 after that failure, so failures stop being free
after four more.

**Practical effect:** a failed build is cheap but not free forever, and the
30-build ceiling is far less tight than assumed. Tyler's one-build-per-approval
rule still stands as discipline — but a failure is not a crisis.

---

## D-016 · Receipt images are exportable, and not behind the paywall

**2026-08-06 · Settled**

Until now the photographs never left the app container. Every export was
data-only, and the JSON backup stored absolute `file://` paths that go stale on
reinstall — so the images existed in exactly one place, invisibly.

That quietly broke the core promise. The IRS accepts electronic records
(Rev. Proc. 97-22) provided the system can reproduce legible copies on demand.
A user who cannot get their images out cannot meet that bar, so the app could
not honestly tell anyone to throw away the paper.

`exportArchive()` produces a single zip — `images/`, `receipts.csv`,
`backup.json` (v3, each entry naming its `imageFile`), `README.txt` — through
the share sheet, so the user picks the destination. No account, no server.

**Not gated behind Pro**, deliberately. The existing JSON backup is free, so
gating images would be inconsistent; and putting a paywall between a user and
their own tax records is how a privacy-first app earns one-star reviews. The
Pro boundary stays where it is: XLSX, TXF, QuickBooks, unlimited scans.

**Would change it:** Tyler's call — it is a one-word change to the export row.

**Still missing:** restore. Reading an archive back needs `expo-document-picker`,
a native module, so it waits for the production build.

---

## D-017 · Long option lists are modals, not inline dropdowns

**2026-08-06 · Settled**

The category picker rendered all 29 options inline in a `<View>` carrying
`maxHeight: 300`. **`maxHeight` on a React Native `View` does not clip or scroll
its children** — the default `overflow` is visible, so every option drew past
the bound and painted over the notes field and the Save/Discard buttons. Both
layers were visible through each other. `ReceiptsScreen` had the same pattern
with no `maxHeight` at all.

`CategoryPicker` is a full-screen modal with a `FlatList`, used by all three
call sites (main category, split category, receipt edit).

A modal is the right shape here beyond fixing the overflow: 29 options don't fit
a cramped inline box; a nested vertical `ScrollView` inside the form's own
`ScrollView` fights it for gestures on iOS; and going full-screen dismisses the
keyboard instead of competing with it.

The dead `catList`/`catItem` styles were deleted rather than left behind, so the
pattern can't be copied forward.

**Rule:** an option list that can exceed a few items gets a modal. If something
inline ever needs bounding, it must be a `ScrollView` — `maxHeight` on a `View`
is not a bound.

---

## D-018 · Dev clients don't auto-update; the app offers a manual check

**2026-08-06 · Settled**

Tyler was still on `js r3` after r4 and r5 published successfully. The channel
was correct — `eas channel:view development` showed r5 as the most recent group
at runtime version 1.0.0, matching the build.

The cause is deliberate `expo-dev-client` behaviour: it **pins whichever update
was launched from its launcher and does not poll the channel**, so you aren't
yanked off the build you're debugging. Force-quitting relaunches the pinned
update. A production build behaves differently — it checks on start, downloads
in the background, and applies on the next launch.

Two consequences:

1. Getting a new revision onto a dev client means dev menu -> Go home -> pick
   the newest entry. Publishing is necessary but not sufficient.
2. **A successful publish is not evidence the device is running it.** Ask for
   the version stamp; don't infer it.

`SummaryScreen` now has "Tap to check for updates" under the version stamp —
`checkForUpdateAsync` -> `fetchUpdateAsync` -> `reloadAsync`, guarded by
`Updates.isEnabled` so it degrades cleanly when running from a dev server.

**Note:** this only helps from r6 onward, since the button ships *in* an update.
Reaching r6 the first time still needs the launcher.

---

## D-019 · Dev-only UI is gated on the release channel, not on a reminder

**2026-08-06 · Settled**

The "Tap to check for updates" affordance (D-018) must not ship in the released
app. Rather than a pre-submission checklist item — which is exactly the sort of
thing that gets forgotten — it is gated on `Updates.channel`:

```js
const showUpdateCheck = Updates.channel === 'development' || Updates.channel === 'preview';
```

`mobile/eas.json` gives the production profile `channel: "production"`, verified,
so the button disappears in a production build with no manual step.

The check **fails closed**: it shows only for explicitly-named non-production
channels, so an unset or unrecognised channel hides it. The safe default is
hidden.

**Rule:** any developer affordance gets the same treatment. A guard that cannot
be forgotten beats a checklist that can.

---

## D-020 · Sales tax must be plausible relative to the total

**2026-08-07 · Settled**

Two real receipts from Tyler both had tax parsed wrong, in different ways:

- **Bass Pro** printed `SALESTAX` / `$13.98 @ 6.0%`. The parser took `13.98` —
  the taxable *base*. The actual tax was OCR-mangled to `$0. 8-`, unreadable.
- **Safeway (Honolulu)** used a column layout where `TAX` is separated from its
  value by header lines, so the adjacent-line fallback grabbed `3.49`, an item
  price. Correct tax was `0.40`.

`tax = max(candidates)` meant a wrong-but-large value always won.

Three changes to `extractTaxInfo`:

1. **Plausibility bound** — a tax candidate above 25% of the grand total is not
   sales tax. This alone rejects both wrong values (94% and 39% of total).
2. **`$X @ Y%` is a base, not a tax** — compute `X × Y` instead. Bass Pro yields
   `13.98 × 6% = 0.84`, which is also more robust than reading a mangled glyph.
3. **Forward scan** — when the adjacent amount is implausible, look ahead up to
   six lines for the first plausible one. Recovers Safeway's `0.40`.

All 10 unit tests still pass, including the Costco FSA exclusion, and the
five-receipt corpus scores zero mismatches.

**Note:** `classifier.js` is shared with the PWA, which inlines its own copy and
therefore still has both bugs. Porting means editing the live `index.html`, so
it needs Tyler's go-ahead.

---

## D-021 · The PWA is retired; the Expo app is the product

**2026-08-07 · Settled by Tyler**

`index.html` was the proof of concept. The Expo app now does everything it did
and more, so the PWA is no longer maintained and parser fixes are **not** ported
back to it. It stays at v5.5 with the two tax bugs fixed in D-020.

This retires the "keep `classifier.js` and `exporters.js` in sync" rule that had
been in `CLAUDE.md` since the handoff. `mobile/` is the only copy that matters.

**`index.html` must not be modified or deleted.** Tyler still has receipts in the
PWA's browser storage that he may export, and that storage is bound to the page
at its current address — replacing the file would strand the data.

---

## D-022 · The App Privacy label is "Purchases, not linked to you"

**2026-08-07 · RESOLVED**

Resolved against RevenueCat's own App Privacy guidance, which Tyler retrieved —
revenuecat.com is blocked from Claude Code sessions.

**"Data Not Collected" is not available.** RevenueCat requires disclosing
Purchase History. But the outcome is far narrower than feared, because of how
this app uses the SDK — each verified in `src/lib/purchases.ts`, not assumed:

| Check | This app | Consequence |
|---|---|---|
| `Purchases.configure({apiKey})` with no `appUserID` | anonymous IDs | Linked to identity → **No** |
| No `setAttributes` / `setEmail` / `setDisplayName` | no customer attributes | Contact Info → **not required** |
| No IDFA, attribution or analytics SDK | none | Device ID → **not required**; Tracking → **No** |

**The label is one row:**

> **Data Not Linked to You** — Purchases (Purchase History)
> Purposes: Analytics, App Functionality. Not used for tracking.

RevenueCat requires both purposes: *App Functionality* covers receipt validation
and entitlements, *Analytics* covers their dashboard features.

Everything else is not collected per their table: no health, financial info,
location (locale and currency code only), sensitive info, contacts, browsing or
search history, or diagnostics.

**The marketing claim survives nearly intact.** The hero comparison cannot say
"Data Not Collected", but it can say **"Data Not Linked to You — purchases
only"** against Keeper, QuickBooks and Wave, which show identity-linked financial
data used for advertising. That contrast is still stark, and it is now provable
rather than aspirational.

**Would change it:** a custom app user ID, customer attributes, an analytics SDK,
or any attribution integration. Each adds rows to the label — so each is now a
marketing decision, not merely a technical one.
