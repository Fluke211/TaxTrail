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

---

## D-023 · "ReceiptSnap" is unusable; the privacy position is contested

**2026-08-07 · Settled — the name must change**

Tyler found an App Store app called ReceiptSnap doing nearly the same thing. A
live search found **four**: three iOS listings and one Android, one of which also
advertises on-device storage, and one of which already ships return-expiry
alerts.

Worse, the differentiator is contested. `MARKET_AND_GTM_STRATEGY.md` §2.2 claims
the on-device/no-account niche is empty with "only occupants having 1 rating
each". [DocuFlexPro](https://docuflexpro.com/) markets 100% on-device AI, no
cloud, no account, Schedule C export, and explicitly pitches finding receipts for
returns. A free Android competitor claims on-device OCR with no accounts and no
subscriptions. Full findings: `docs/MARKET_REASSESSMENT_2026-08.md`.

**How this was missed.** D-013 recorded that the App Store name was taken, which
forced the record to "ReceiptSnap: Expense Organizer". That fact sat in the canon
and was cited repeatedly without anyone asking *what the app that took it does*.
A taken name in your own category is a competitor signal.

Compounding it: **WebSearch was available the whole time and was never used for
market questions.** Expo and RevenueCat being blocked created a false impression
that outbound research was unavailable. It was not.

**Consequences:**

1. The name changes. Criteria and a verification checklist are in the
   reassessment doc — App Store (both stores), USPTO, domain, distinctiveness,
   ASO. No candidate goes into the repo before all of it is checked live.
2. The bundle identifier changes with it. Permanent once shipped (D-005);
   nothing has shipped, so this is still free.
3. The headline claim changes. "Private, on-device" is no longer differentiating
   on its own. What competitors do not match is **Schedule C depth** — 29
   categories mapped to IRS lines, tax-aware splitting, TXF export, city
   sales-tax memory. Lead with depth; privacy becomes strong support.
4. D-002's pricing reasoning is incomplete — it was set against cloud
   competitors, not a free on-device one. Revisit before launch.

**The rule this produces** is now in `CLAUDE.md`: verify market claims against
live sources, and treat an unavailable name as a research trigger.

**What it did not cost:** nothing shipped publicly. No users, no reviews, no
rankings, no domain purchased. The expensive version of this mistake — finding
out after launch — did not happen.

---

## D-024

**Control Center / launcher shortcuts: ship the Shortcuts deep link, defer the
native control.**

Date: 2026-08-10 · Status: accepted

Tyler asked whether the app can put a scan button in the iOS Control Center and
the Android equivalent. Four paths exist. Verified each before recommending,
per the rule in `CLAUDE.md`.

**What is available today, for free, with build 1 already installed.** iOS 18's
Control Center gallery includes an **Open App** control under the Shortcuts
group — Control Center → *Add a Control* → Shortcuts → *Open App*. Any installed
app qualifies. Nothing is required of us. It opens the app to wherever it last
was, not to the camera.
([Apple Support](https://support.apple.com/guide/shortcuts/run-shortcuts-from-control-center-apd06a9201d4/ios))

**What we should actually ship: a URL scheme.** The same gallery has a
**Shortcut** control that runs any user shortcut. A one-action shortcut —
*Open URL `slipjar://capture`* — placed in Control Center lands the user
directly in the scanner. It also works from the Lock Screen, the Action Button
(iPhone 15 Pro and later), Back Tap, and the Home Screen, from one piece of
work.

The cost is one line: `"scheme": "<name>"` in `mobile/app.json`, which today has
**no scheme at all** (verified). That writes `CFBundleURLTypes` into
`Info.plist`, so it is a **native build** — but the rename forces a new bundle
identifier and therefore a new build anyway, so it batches in at zero marginal
cost. Handling the link in JS is `expo-linking`, already present, and ships over
the air.

Android gets the same thing from an intent filter on the scheme; the launcher
long-press shortcut (`shortcuts.xml`) can carry that URI with no native module.

**What we are deferring: a real Control Center control** with our own icon and
label, no user setup. This is a WidgetKit `ControlWidget`, which must live in a
widget-extension target.

- Expo's official `expo-widgets` is **SDK 56 and later** — npm's earliest
  published version is `56.0.21`, and nothing exists on the 55.x line. We are on
  SDK 55. Not an option without an SDK upgrade.
- `@bacons/apple-targets@5.0.0` **is** built for our SDK — it depends on
  `@expo/prebuild-config ~55.0.6` and dev-depends on `expo ^55` — and its
  supported target list includes `widget` and `app-intent`. So the path is real.
- But it means hand-written SwiftUI, and sharing data with the extension needs
  an **App Group entitlement**. Per D-011, adding an entitlement invalidates a
  provisioning profile created before it: signing then fails, and fixing it is
  an interactive Codespace trip. That is the same failure that cost us build 1.

**What we are not using: `expo-quick-actions`.** Home-screen long-press quick
actions would be a reasonable middle step, but the package has **no SDK 55
release**: `5.0.0` builds against `expo-modules-core ^2.3.12` (SDK 53),
`6.0.0`/`6.0.1` against `^3.0.15` (SDK 54), and `6.0.2` against `^56.0.13`
(SDK 56). SDK 55 ships `expo-modules-core 55.0.25`. `peerDependencies` is
`expo: "*"`, so npm would install it happily and the failure would surface at
native compile time. Not worth a build slot to find out.

**Android Quick Settings tile** — the true Control Center analogue — needs a
`TileService`, and no Expo wrapper was found. Deferred with the rest of Android,
which has never been audited.

**Decision:** add the URL scheme and a `capture` deep link to the production
build. Document the Control Center shortcut in the App Store listing and the
support page as a setup tip. Revisit the native control when we move to SDK 56,
where `expo-widgets` makes it a supported path rather than a custom one.

---

## D-025

**Standing rules live in three places, not one, because no single place reaches
every surface.**

Date: 2026-08-10 · Status: accepted

The ReceiptSnap name failure (D-023) had two causes: a settled fact in the canon
was never treated as a signal, and live search was never used for a market
question. Both fixes landed in `CLAUDE.md` — which **only Claude Code reads**.
Tyler also works in Cowork sessions and ordinary chat, and a separate session
("Atlas") drove the RevenueCat work. A rule that lives only in this repo does
not reach any of them.

The mechanisms, and what each actually covers:

| Where | Scope | Reaches |
|---|---|---|
| **claude.ai → Settings → Profile → custom instructions** | Every conversation on the account | Chat, Projects, Cowork — **and** it is the only account-wide surface |
| **claude.ai Project instructions** | Every chat inside that Project | Chat and Projects only |
| **Repo `CLAUDE.md`** | Any session whose working directory is this repo | Claude Code, and Cowork when pointed at this folder |
| `~/.claude/CLAUDE.md` | All projects on one machine | Not durable here — remote session containers are ephemeral |
| `.claude/rules/*.md` | Loaded like `CLAUDE.md`; `paths:` frontmatter scopes to file globs | Same reach as `CLAUDE.md` |

([Claude Code memory docs](https://code.claude.com/docs/en/memory))

Two properties matter and are easy to get wrong:

1. **None of these are enforcement.** The docs are explicit that CLAUDE.md is
   context, not configuration — "there's no guarantee of strict compliance."
   For something that must happen every time, a hook or a CI check is the
   mechanism. A rule in prose is a strong nudge.
2. **Length is inversely related to adherence.** The guidance is under 200 lines
   per file, and roughly 500 words for profile instructions. `CLAUDE.md` is
   already past that, which is an argument for moving procedure into
   `.claude/rules/` over time rather than adding to it.

**Decision:** the two rules that caused real damage are *behavioural and
cross-surface*, so they go in **profile custom instructions**, where every
surface picks them up. Everything project-specific stays in `CLAUDE.md`. The
exact text to paste is `docs/CROSS_SURFACE_RULES.md` — kept in the repo so it is
reviewable, versioned, and reachable from a phone browser.

---

## D-026

**Renamed to TaxTrail — and six identifiers deliberately still say ReceiptSnap.**

Date: 2026-08-10 · Status: accepted

Closes D-023. Tyler cleared **`TaxTrail: Receipt Scanner`** in App Store Connect
with subtitle *"Categorization for Schedule C"*, confirmed **zero USPTO hits**
for TAXTRAIL (searches for "tax trail" return only TAX and TRAIL separately),
and confirmed `taxtrail.app` is available at $10.98. Due diligence is in
`docs/NAMING_2026-08.md` §6. He asked for every instance to change "if we can
do it" — this records where we could not, and why.

84 strings across 21 files were renamed. The exceptions:

**1. `receiptsnap.db` — the SQLite filename stays.** `src/lib/db.ts` opens the
database by name. Renaming it makes the app open a fresh, empty database and
Tyler's scanned receipts become invisible — still on disk, but unreachable
without a migration. A cosmetic rename is not worth a data-loss path. The
filename is never shown to a user.

**2. `receiptsnap_pro_monthly` / `_annual` / `_lifetime` — the product IDs
stay.** These are App Store Connect product identifiers and are permanent once
created. Renaming means deleting and recreating them, which discards the
`ONE_WEEK` trial on the annual and the full territory price schedules already
configured (STATUS.md). They are internal strings no user ever sees. The
RevenueCat entitlement `pro` and offering `default` are unaffected. **They are
not hardcoded anywhere in `src/`** — offerings are fetched at runtime — so this
costs nothing in the codebase.

**3. `"slug": "receiptsnap"` in `app.json` stays — permanently, as it turns
out.** (Amended 2026-08-10 after testing; see D-028.) EAS CLI validates
the slug against the project identified by `extra.eas.projectId` and errors on a
mismatch. The project is `@tylerthornbrue/receiptsnap` on expo.dev, which cannot
be renamed from here — **every Expo domain returns a gateway 403** in these
sessions. Changing the slug before the server side would break the Actions
workflow, which is the only EAS interface we have. Two-step: Tyler renames the
project at expo.dev in a browser, then the slug flips. The `projectId` and the
`updates.url` are UUIDs and carry no name, so OTA updates are unaffected either
way.

**4. `index.html` and `setup-receiptsnap-mobile.sh` — untouched, per the
guardrail.** The PWA is retired but live, and Tyler still has unexported
receipts in its browser storage, which is bound to the page at its current
address. The installer is kept byte-unchanged deliberately.

**5. History is not rewritten.** `DECISIONS.md`, `CHANGELOG.md`,
`ROADMAP.md`, `docs/MARKET_REASSESSMENT_2026-08.md`, `docs/NAMING_2026-08.md`
and `docs/CROSS_SURFACE_RULES.md` keep "ReceiptSnap" wherever it refers to the
old name. D-013 and D-023 are *about* that name — find-and-replacing them would
erase the record of the mistake, which is the one thing guaranteeing we do not
repeat it. Renaming history to match the present is how a project forgets.

**6. `receipt-snap` — the GitHub repo name.** Tyler's to change. It is in the
GitHub Pages URLs that `privacy.html` and `support.html` are served from, and in
`FallbackPaywall.tsx`'s `PRIVACY_URL`, so those three change together with it or
they 404. Left correct-as-of-today rather than pre-emptively broken.

**The bundle identifier DID change** — `com.tylerthornbrue.receiptsnap` →
`com.tylerthornbrue.taxtrail`, on both iOS and Android. This is the one
expensive part, and it was Tyler's explicit call. It is permanent once shipped
(D-005) and nothing has shipped, so the window is now. It costs a new App ID, a
regenerated provisioning profile — an interactive Codespace trip, since
`eas credentials` has no non-interactive mode (D-004) — and a build. The build
was already required for the URL scheme (D-024) and `expo-document-picker`, so
they share one.

---

## D-027

**Launch on a borrowed email; buy the domain anyway.**

Date: 2026-08-10 · Status: accepted (with a dissent recorded)

Tyler's call: hold off on `taxtrail.app` and use `taxtrail@vaultvision.team` —
an address on a domain he already owns — so the app can ship and prove it earns
anything before more money goes in. That is now wired into `privacy.html` and
`support.html`, unblocking submission.

**The principle is right.** Apple requires a working support URL, a privacy
policy URL and a reachable contact. None of those require owning the brand's
domain. GitHub Pages serves both documents free, and the support email only has
to deliver. Spending before evidence is how projects die slowly, and this one
has already lost a week to an unverified assumption.

**The specific call is a bad trade, and this records why.** The sum is $10.98
a year, against $99 already committed to the Apple Developer Program and a
month of Tyler's evenings. Deferring it does not preserve meaningful
optionality — it is not the marginal dollar that decides whether this ships.

What it does do is create an asymmetric risk. `taxtrail.app` is unregistered
*today*. The moment the app is listed, the name becomes public and searchable,
and the domain becomes a thing someone can take for the same $10.98 — to park
it, resell it, or point it at something we would not want our users to find.
For an app whose entire pitch is "your receipts never leave your phone",
`taxtrail.app` resolving to somebody else's page is a trust problem that no
amount of listing copy repairs. The downside is small but effectively
irreversible; the cost of avoiding it is eleven dollars.

There is a second, softer cost: a support address on `vaultvision.team` reads
as unrelated to the product. App Review will not care. A privacy-conscious user
looking up who they are emailing might.

**What makes this reversible:** the support and privacy contact fields are App
Store *metadata*. Changing them later needs neither a build nor a review cycle,
so switching to `support@taxtrail.app` whenever the domain is bought costs
nothing. That is what makes shipping on the placeholder genuinely safe.

**Recommendation on the record:** buy `taxtrail.app` as a defensive
registration, not as a website. Keep the `vaultvision.team` address until there
is revenue. The $10.98 buys the name, not the infrastructure.

**Before submission, confirm `taxtrail@vaultvision.team` actually delivers** —
forwarding is configured per-address on that domain, and a support address that
bounces is worse than one on the wrong domain.


---

## D-028

**The Expo slug stays `receiptsnap` for good. Renaming the project did not
change it, and it is invisible to users.**

Date: 2026-08-10 · Status: accepted · Amends D-026

D-026 held the slug back and called it a two-step: Tyler renames the project at
expo.dev, then the slug flips. He renamed it. The flip still failed.

**Tested, not assumed** — two free `usage` runs, which cost nothing:

| Ref | `slug` in `app.json` | Result |
|---|---|---|
| `claude/receiptsnap-github-work-4rcvdf` | `taxtrail` | **failure** — `eas build:list` errored after a successful login |
| `main` | `receiptsnap` | **success** |

Identical workflow, identical token, minutes apart. The only difference was the
slug, so the server-side slug is still `receiptsnap`. Renaming a project in the
expo.dev dashboard changes its **display name**; the slug that
`extra.eas.projectId` resolves against does not follow.

**Decision: stop chasing it.** The slug appears in exactly one place a human
ever sees — the `expo.dev/accounts/tylerthornbrue/projects/<slug>` URL. It is
not in the app, not in the App Store listing, not in the bundle identifier, and
not in the OTA update URL (`updates.url` is the project UUID). The upside of
changing it is zero; the downside is breaking the Actions workflow, which is the
only EAS interface these sessions have, since every Expo domain returns a
gateway 403.

A future SDK upgrade or a fresh EAS project would be a natural moment to let it
change. Until then it is a piece of internal plumbing wearing the old name, like
`receiptsnap.db` and the three product IDs.

**Method note worth keeping:** the `usage` step is free and touches EAS for
real, which makes it a general-purpose probe for "did I just break the Expo
project config?" Running it on `main` as a control is what turned a vague
`build:list command failed` into a one-variable answer.

---

## D-029

**taxtrail.app is hosted on Cloudflare Pages from `site/`. GitHub Pages is left
alone on purpose — a custom domain there would strand Tyler's PWA receipts.**

Date: 2026-08-10 · Status: accepted · Answers "do we need the GitHub site or
the taxtrail.app website?"

**Answer: one canonical home, and it should be `taxtrail.app`.** GitHub Pages
was the stopgap while there was no domain. But the two are not
interchangeable, and the obvious move — pointing `taxtrail.app` at the existing
GitHub Pages site — is the one that must not be made.

**The hazard.** Setting a custom domain on a GitHub Pages site makes GitHub
redirect `<user>.github.io/<repo>` to that domain. The retired PWA
(`index.html`) is served from this repo's root, and Tyler still has unexported
receipts in its browser storage. **`localStorage` is scoped to the origin** —
`https://fluke211.github.io` — not to the path. That is why renaming the repo
from `receipt-snap` to `TaxTrail` was harmless: verified, the PWA still answers
200 at `https://fluke211.github.io/TaxTrail/` and the origin never moved. A
custom domain *does* move it. His receipts would still exist in the browser
under the old origin with no page left able to read them.

So GitHub Pages keeps serving the repo root, with no custom domain, until those
receipts are exported.

**The split:**

| | Serves | From |
|---|---|---|
| **Cloudflare Pages → `taxtrail.app`** | Landing page, privacy policy, support | `site/` |
| **GitHub Pages → `fluke211.github.io/TaxTrail/`** | The retired PWA, plus the current App Store URLs | repo root |

Cloudflare Pages' Git import takes a **build output directory**, so pointing it
at `site/` serves only those three files and never the PWA at the root. The repo
stays the single source of truth for both, which is the property Tyler actually
cares about — nothing is authored in a dashboard.

**Sequencing, deliberately.** The App Store URLs and the app's `PRIVACY_URL`
still point at GitHub Pages and **do not move until `taxtrail.app` answers 200**.
Switching them first is exactly the bug that shipped in js r10 — the repo rename
moved the Pages path and left the paywall linking to a 404. Guideline 3.1.2
requires a working privacy link on the purchase screen, so an unverified URL
there fails review.

**Later, once the PWA receipts are exported:** collapse the duplication by
turning the root `privacy.html` / `support.html` into redirects to
`taxtrail.app`. Two copies of a privacy policy is a drift hazard, and it is
accepted only while both addresses have to work.

---

## D-030

**Email is `support@taxtrail.app` via Cloudflare Email Routing. One address, not
three.**

Date: 2026-08-10 · Status: accepted · Supersedes the placeholder in D-027

D-027 shipped `taxtrail@vaultvision.team` as a borrowed address. Tyler bought
`taxtrail.app` (Cloudflare Registrar, $14.20), so that is resolved.

**One address, not a set.** `support@`, `privacy@`, `hello@` and `legal@` is
what a company with a support team does. For a solo developer it is four routing
rules, four things to check, and four ways to silently drop a customer email.
`support@taxtrail.app` goes in the privacy policy, the support page, the landing
page, and the App Store listing. A catch-all rule backstops anything else, so
mail to a guessed address still arrives.

**Cloudflare Email Routing rather than a mail host** — free, requires no
mailbox, and forwards to the inbox Tyler already reads. It configures its own
MX, SPF and DKIM records on the root domain automatically, and requires the
domain to use Cloudflare DNS, which a Cloudflare Registrar domain does by
default. Procedure in `docs/RUNBOOK.md`.

**It bounces until Tyler enables it**, which is why the app and the App Store
listing are not switched to it in the same change. Verify delivery first — a
support address that bounces is worse than one on the wrong domain.

---

## D-031

**Cloudflare gets a driver workflow, for the same reason EAS did.**

Date: 2026-08-10 · Status: accepted

Tyler asked whether Cloudflare could be configured directly, and whether some
other MCP server would give more access. Checked rather than assumed.

**No MCP path exists.** The connected **Cloudflare Developer Platform** server
covers compute and storage only — KV, R2, D1, Hyperdrive, Workers read, plus
`accounts_list` and the docs search. **No DNS, no Email Routing, no Pages.** A
registry search for DNS / email-routing / Pages returns that same server and
nothing else, so there is no second Cloudflare connector to add.

**The REST API is reachable, though.** `api.cloudflare.com` answers `400` from
these sessions — a real response from Cloudflare, not a proxy block. So the API
is usable; only the credential is missing.

**Decision: drive it from GitHub Actions, exactly like EAS.** A scoped token in
repository secrets, a `workflow_dispatch` workflow, and an agent triggering runs
and reading logs through the GitHub API. That pattern already exists here for a
near-identical reason (D-003: Expo domains are 403 from these sessions), Tyler
never has to paste a credential into a chat transcript, and the token is never
printed. `.github/workflows/cloudflare.yml` has `status` / `email` / `pages` /
`verify`.

Rejected alternative: having Tyler paste an API token into the conversation. It
would work, and the API is reachable, but the token would then live in the
transcript permanently. The secrets route costs one extra browser step and
avoids that entirely.

**What the automation still cannot do:** Cloudflare emails a verification link
to any new destination address, and the docs are explicit that **all routing
rules stay disabled until that link is clicked**. No API call substitutes for
it. Same for creating the token itself. Those two stay manual; everything else
is scriptable.

**Pages uses Direct Upload, not the Git integration.** Connecting a repo to
Pages needs a browser OAuth handshake that has no API equivalent. Direct upload
via `wrangler pages deploy site` is fully scriptable, deploys the same
`site/` directory, and has the side benefit of running from the same Actions
pipeline as everything else. D-029's split is unchanged — only the mechanism is.

---

## D-032

**Verify a credential by capability, not by a status endpoint — and never
assert a format from memory.**

Date: 2026-08-11 · Status: accepted

Getting the Cloudflare token working cost four runs and one needlessly rolled
credential. Both causes are the same mistake in different clothes, and this is
the third time this project has been bitten by it (D-013, D-023).

**Mistake one: an unverified fact stated as a check.** The preflight asserted
that a Cloudflare API token is 40 characters. That came from memory. It is
wrong — Tyler's token is 53, and so was the replacement he rolled *because of
the assertion*. A confident, specific, wrong diagnosis is worse than no
diagnosis: it sent him to do work that could not help.

The rule that already exists in `CLAUDE.md` — verify before recommending —
applies to **the contents of a check**, not just to advice given in prose. A
hardcoded expectation is a claim. If it cannot be verified, it must not be
allowed to fail the run; print it as information and let a real call decide.

**Mistake two: health-checking against the wrong endpoint.**
`/user/tokens/verify` is user-scoped. Cloudflare issues both user-owned and
account-owned API tokens, and an **account-owned token returns 401 there while
being completely valid**. The preflight could never have passed for Tyler's
token, and it reported that as "invalid credential".

**The general rule: verify a credential by doing the smallest real thing you
actually need it for.** Here that is `GET /zones?name=taxtrail.app` — the call
every subsequent step depends on anyway. It cannot be wrong about scope,
because it *is* the scope. And its failure modes are informative on their own:
401 the credential was rejected, 403 a permission is missing, 200 with an empty
result the resource is outside the token's scope.

**Corollary: never let a diagnostic swallow an error.** The first `status` step
printed `(no rules)` both when the call succeeded with an empty list and when it
failed — identical output for "nothing configured" and "not allowed". Printing
each endpoint's HTTP code turned a guessing loop into a single answer: zone DNS,
routing settings and routing rules all 200; account routing addresses and Pages
both 403. The token is zone-scoped, which no amount of re-reading the dashboard
would have revealed.

This matters more here than on most projects because Tyler is phone-only. Every
vague failure costs a full exchange, so a diagnostic that says "wrong, try
again" is not neutral — it spends the scarcest resource in the project.

---

## D-033

**`taxtrail.app` is live. Attaching a Pages custom domain does not create the
DNS record — you have to.**

Date: 2026-08-12 · Status: accepted · Completes D-029

Tyler added the two Account-level permissions and both endpoints flipped from
403 to 200, which unblocked everything. The site now serves from Cloudflare
Pages at `taxtrail.app`.

Three things that were not obvious and cost a round each:

**1. The Pages API reports a custom domain as "attached" while `taxtrail.app`
still resolves to nothing.** The attach call returned success and the zone had
no A, AAAA or CNAME at the apex. The record has to be created separately: read
the project's real `pages.dev` subdomain from
`GET /accounts/:id/pages/projects/:name` and point the apex at it with a
**proxied** CNAME, which Cloudflare flattens at the root.

**2. The project's subdomain is not the project name.** Cloudflare assigned
`taxtrail-arf.pages.dev`, not `taxtrail.pages.dev`. Hardcoding the expected name
would have produced a CNAME pointing at nothing — the same class of mistake as
D-032's token length. The workflow reads it from the API.

**3. A fresh custom domain returns 522 before it settles.** Cloudflare's edge
answers before it can reach the Pages origin, and the three pages returned a
mix of 200, 522 and connection failures for the first couple of minutes.
**Do not act on the first 200** — the check that matters is five consecutive
200s per page, which is what was actually run before repointing anything.

**Cloudflare rewrites the `mailto:` links, deliberately.** Scrape Shield's Email
Address Obfuscation replaces `support@taxtrail.app` with a
`/cdn-cgi/l/email-protection` link decoded by JavaScript. Left **on**: it is
exactly the anti-harvesting protection a solo developer's public support address
wants, and every real browser — including App Review's — renders it normally.
Worth knowing before someone reports the address as "missing" from the page.

**The destination address needed no verification email.**
`tylerthornbrue@gmail.com` was already a verified destination on the account,
presumably from VaultVision. The catch-all rule now forwards everything at
`taxtrail.app` to it; the `support@` rule reported `Duplicated Zone rule`,
meaning one already existed.

With the site verified, the app's `PRIVACY_URL` and both App Store URLs move to
`taxtrail.app` (js r11) — the sequencing D-029 insisted on, and the reason js
r10 exists.

---

## D-034

**An App Store Connect API key removes the Codespace requirement. D-004 and the
`CLAUDE.md` note about interactive Apple auth are superseded.**

Date: 2026-08-12 · Status: accepted

`CLAUDE.md` has said since the handoff that "the Codespace is only for
interactive Apple authentication, which CI cannot do — neither `eas credentials`
nor `eas credentials:configure-build` accepts `--non-interactive`." Half of that
is still true, and the conclusion drawn from it was wrong.

Verified by unpacking **eas-cli 22.0.0** and reading the shipped code, not from
memory:

- `commands/credentials/configure-build.js` hardcodes `nonInteractive: false`.
  **That command genuinely cannot run in CI** — the original observation holds.
- But `credentials/ios/actions/CreateProvisioningProfile.js`,
  `SetUpProvisioningProfile.js` and `ConfigureProvisioningProfile.js` all throw
  the *same* message: *"authentication with an ASC API key is required in
  non-interactive mode. Either set the
  `EXPO_ASC_API_KEY_PATH`/`EXPO_ASC_KEY_ID`/`EXPO_ASC_ISSUER_ID` environment
  variables…"* — which is a statement that **with** those variables, it works.
- `SetUpTargetBuildCredentials.js` calls `ensureBundleIdExistsAsync`, so EAS
  **registers the App ID on Apple itself**. That is the first link of the bundle
  identifier chain, and it needs no browser.

So the constraint was never interactivity. It was the absence of an ASC API key.
With one, a build creates the App ID, the distribution certificate and the
provisioning profile, all in CI.

**Where the credential work happens: inside `eas build`.** There is no free
preflight for it — `configure-build` is the interactive-only command. A
credentials problem therefore surfaces as a failed build. Failed builds are
waived rather than charged (D-015), but the waiver pool is account-wide and was
at 6/10, so this is cheap rather than free.

**Key handling.** Three repository secrets: `ASC_API_KEY_P8` (the whole file,
`BEGIN`/`END` lines included), `ASC_KEY_ID`, `ASC_ISSUER_ID`. The workflow
writes the key to `$RUNNER_TEMP` at mode 600 — outside the repo, so it cannot be
committed — checks only that the first line looks like a PEM header, exports the
three env vars, and shreds the directory in an `always()` step. The contents are
never printed.

**The key needs Admin access**, not Developer: creating certificates and
identifiers is an Admin-scoped operation. Generate it under Users and Access →
Integrations → **Team Keys**, not as an individual key.

**What this does not solve: the App Store Connect record's bundle identifier.**
Apple's own guidance is that it "can't be changed after you upload your first
build", and the field is frequently greyed out regardless. Uploaded builds is
still 0, so it may be editable — but that is a look-and-see in the browser, and
the ASC API offers no way to change it.

---

## D-036

**RevenueCat gets a driver workflow too — and the key already in the repo is
the wrong kind.**

Date: 2026-08-17 · Status: accepted

Tyler asked whether he had already set up a RevenueCat key. He had not, and the
reason it is easy to think otherwise is worth writing down: **there is a
RevenueCat key in this repo, and it cannot do any of this.**

| | `appl_lkFpBkvUDvsOfXJAZJluSWduCIv` | what is needed |
|---|---|---|
| Kind | **public SDK key** | **v2 secret key** (`sk_…`) |
| Lives in | `src/lib/config.ts`, shipped in the app | repository secret, never in the binary |
| Safe to publish? | **yes, by design** | **no** |
| Can it change project settings? | **no** — client-side only | yes, with the right permission |

The public key is what the SDK authenticates purchases with; it is meant to be
readable inside a shipped app. Managing the project needs a v2 secret key from
**Project settings → API keys**, version **V2**, with
`project_configuration:apps:read_write`.

`.github/workflows/revenuecat.yml` follows the pattern the Cloudflare and Apple
work settled into (D-031, D-034): a scoped credential in repository secrets, a
`workflow_dispatch` driver, and an agent reading the logs back. Three services,
three drivers, one shape.

Two things carried over deliberately from those:

- **The preflight names the likely mistake.** Pasting the `appl_` key here is
  the obvious error, so the shape check catches it and says exactly why it is
  the wrong credential, rather than letting the API return an opaque 401. This
  is the D-032 lesson: a diagnostic that only says "rejected" costs a whole
  exchange when the user is not at a terminal.
- **401 and 403 are reported differently.** Rejected key versus missing
  permission are different problems with different fixes, and they are
  indistinguishable if you only print "failed".

**Where it is deliberately unsure:** RevenueCat's API reference is blocked from
these sessions, so the exact verb for updating an app could not be read. The
step tries `POST`, reports the code, then tries `PATCH`, and reports that too —
if both fail it says to change it in the dashboard rather than pretending. One
run will settle which is right, and the workflow can then be simplified.

**Why the bundle identifier matters here at all:** RevenueCat validates receipts
against the app's bundle identifier. Leaving it as `com.tylerthornbrue.receiptsnap`
after the rename means purchases fail validation — which would look like a
paywall bug long before anyone suspected a stale dashboard field.

---

## D-037

**Correcting D-034: an ASC API key does not create a distribution certificate.
One interactive session is still required — exactly one.**

Date: 2026-08-20 · Status: accepted · Amends D-034

The production build failed at credential setup. The diagnosis, read from
eas-cli 22's shipped source rather than inferred from the error text:

```js
async runNonInteractiveAsync(_ctx, currentCertificate) {
    // TODO: implement validation
    log.warn('Distribution Certificate is not validated for non-interactive builds.');
    if (!currentCertificate) { throw new MissingCredentialsNonInteractiveError(); }
    return currentCertificate;
}
```

The warning prints unconditionally and is not the failure. The failure is
`!currentCertificate`: **eas-cli reuses a distribution certificate
non-interactively but never creates one.**

**What I got wrong.** D-034 said an ASC API key means credentials can be created
in CI. I verified the three *provisioning-profile* actions, found they support
ASC keys, and generalised to "credentials". `SetUpDistributionCertificate` is a
separate action carrying a literal `// TODO`, and I never opened it. The profile
half of D-034 is verified and stands — it is why the App ID and the `asc-*`
steps work. The certificate half was inference dressed as a finding, which is
the same error as the token-length assertion in D-032.

**What Apple actually holds**, from `asc-check`:

| | |
|---|---|
| `IOS_DISTRIBUTION` certificate | **exists** — "Tyler Thornbrue", expires **2027-05-31** |
| `IOS_APP_STORE` profile | **none** |
| `IOS_APP_ADHOC` profiles | two — old bundle id, and VaultVision |

So the certificate is not missing from *Apple*. It is missing from **EAS's
credential store for this app and this distribution type**. EAS keys credentials
per (app, distribution type); the August certificate was registered against
`com.tylerthornbrue.receiptsnap` with ad-hoc distribution, and `production` is a
different app identifier and a different distribution type.

**The failed build cost nothing.** `eas build:list` still shows **two** builds
total, both from 2026-08-02. Today's failure happened client-side during
credential setup and never reached the build queue — so it consumed neither the
monthly quota nor the waiver pool. Worth knowing before deciding how cautious to
be about the retry.

**Decision: one interactive `eas credentials -p ios -e production` session,
reusing the existing certificate.** It registers that certificate against the
new app and creates the App Store profile. Every build after it is
non-interactive, because eas-cli will then *find* a certificate to reuse. That
is one session, not a recurring tax — the certificate is good until May 2027.

**Rejected for now: local credentials.** `credentials.json` with
`credentialsSource: "local"` would remove interactivity permanently, and the ASC
API can mint a certificate and profile without a browser. But it needs a new
distribution certificate (the existing one's private key lives on Expo's
servers, not anywhere reachable), consumes one of Apple's limited certificate
slots, and puts a `.p12` private key in repository secrets. That is a lot of new
machinery to avoid ten minutes of Tyler's time, once. Revisit if the interactive
session proves painful or has to be repeated.

---

## D-038

**New app icon: a receipt cut at both ends, with shallow teeth. Staged, not
built.**

Date: 2026-08-22 · Status: accepted

Tyler installed build 2 from TestFlight and said the icon looked like "a broken
piece of paper with the zig zag feature at the bottom." He was right, and the
reason is worth writing down rather than just fixing.

**Why the old one failed.** The torn edge was drawn as large sharp triangles
*hanging below* the card's rounded bottom. That broke the silhouette, so at icon
size the eye read damage rather than perforation. Deep teeth plus a broken
outline is what "shattered" looks like.

**What replaced it (variant B4 of four shown):**

- Cut at **both** ends, because a real receipt is a strip torn from a roll —
  Tyler's suggestion, and it is more honest than cutting only the bottom.
- **Shallow, numerous teeth** (32 at 18px on a 1024 canvas). Fine perforation
  survives downscaling as texture; deep teeth turn into a sawtooth.
- Notches carved **into** the card, never drawn hanging off it, so the
  silhouette stays whole.
- **Square corners on the cut edges.** Rounding fights a cut; the two read as
  contradictory instructions.

Chosen against 60px renders, not just the 1024 master. The App Store shows an
icon large, but users see it at 60–120px daily, and that is where the earlier
candidates fell apart.

**Two things found while regenerating.** The Android adaptive foreground was
still **Expo's default blue chevron** — unrelated to this app, and it would have
shipped as the Android icon. And the first regeneration scaled the whole canvas
to reach Android's safe zone, which shrank the card to a speck; the fix crops to
the card and re-fits it so it *fills* the zone.

**The artwork is now code** — `mobile/scripts/make-icons.py` generates all seven
assets from one definition. They were opaque binaries nobody could adjust, which
is how a default chevron survived this long. The next tweak is a diff.

**Deliberately not built.** App icons are compiled into the binary and cannot
ship over the air, so this needs a build. Tyler is using TestFlight and will
find more; batching costs one build instead of two. `APP_BUILD` stays at 2 until
that build actually runs.

---

## D-039

**The iOS build number lives in git, not on a runner — `autoIncrement` is off,
and a free App Store Connect read guards every production build.**

Date: 2026-08-22 · Status: accepted · Amends D-008 (version-stamp discipline)

Found while confirming the staged icon: **the repo and the binary disagreed
about which build Tyler is holding.** `mobile/app.json` said `buildNumber: "1"`
and `version.ts` said `APP_BUILD = 1`, but the build on TestFlight is build 2.
So the Summary footer on his phone reads `build 1` on a build-2 binary — the
version stamp, which exists precisely to answer "which one is this?", was
naming the wrong thing.

**The cause, read from eas-cli 22.2.0's shipped source rather than inferred.**
`eas.json` had `autoIncrement: true` on the `production` profile with
`appVersionSource: "local"`. In `build/build/ios/build.js`:

```js
localAutoIncrement: ctx.easJsonCliConfig?.appVersionSource === AppVersionSource.REMOTE
  ? false
  : ctx.buildProfile.autoIncrement,
```

which resolves to `BumpStrategy.BUILD_NUMBER`, and then in
`build/build/ios/version.js` eas-cli reads `expo.ios.buildNumber` from
`app.json`, computes the next value, and **writes it back into `app.json` in
the working directory**. On a GitHub Actions runner that write is discarded
when the job ends. The committed value never moves.

**What that would have cost, concretely.** Every production build starts from a
clean checkout of `buildNumber: "1"` and produces build **2** — the number
already uploaded. App Store Connect requires `CFBundleVersion` to be unique for
a given `CFBundleShortVersionString`, so the next `eas submit` would have been
rejected as a duplicate *after* the build was spent. One build out of the 30/mo
allowance, burned for nothing, discovered only at the upload step.

**Decision.**

1. `autoIncrement` is removed from the `production` profile. The build number is
   set in `mobile/app.json` and committed, so `app.json`, the `Info.plist`, the
   in-app footer, `CHANGELOG.md` and TestFlight all carry the same number and
   it is in git.
2. `app.json` and `version.ts` are corrected to **2**, which is the truth: it is
   what is on TestFlight today.
3. **Bumping is now part of the pre-build commit**, not a runner side effect —
   see `docs/RUNBOOK.md`. This is what Tyler's standing rule ("bump `APP_BUILD`
   on every native build") always assumed; with `autoIncrement` on, the rule was
   unfollowable, because the number was not decided until after the commit.
4. A **`Build number preflight`** step in `.github/workflows/eas.yml` asks App
   Store Connect which build numbers already exist for the current marketing
   version and fails the run if `buildNumber` is not above all of them. It runs
   **before** `eas build`, so a caught mistake costs no quota, and it is a free
   API read.

**Why a guard and not just a note.** A note in a runbook is checked by whoever
remembers to check it; the failure mode here is silent until Apple rejects an
upload, which is the most expensive place to learn about it. The preflight is
`::error::`-hard when Apple answers and the number is taken, and a `::warning::`
that lets the build proceed when Apple cannot be reached — an unreachable API
is not a reason to block a build Tyler has already approved.

**What would change this:** switching `appVersionSource` to `remote`, which
moves the number to EAS's servers. That trades a git-visible number for one
neither Tyler nor the repo can see without a network call, so it is the wrong
direction for a project whose first rule is that every deliverable carries a
visible version.

---

## D-040

**PR #37's commit message described app changes its diff never contained. The
work was redone; the lesson is that a squash message is not evidence.**

Date: 2026-08-22 · Status: accepted

Found while confirming the staged icon. `git show --stat dd4221a` on
*"Stage the build: deep link, restore-from-archive, and a RevenueCat driver
(#37)"* lists four files: `revenuecat.yml`, `CHANGELOG.md`, `DECISIONS.md`,
`STATUS.md`. **Nothing under `mobile/`.** The message claims, in detail, work
that is not in the commit:

| Claimed in the message | Actually in the repo before today |
|---|---|
| `taxtrail://capture` deep link | no `scheme` in `app.json`, no `Linking` in `App.tsx` |
| Restore from archive | no `restoreArchive`, anywhere in the history |
| `expo-document-picker` added | not in `package.json` |
| *"fixes the app header, which still read ReceiptSnap"* | header still read `Receipt<Text>Snap</Text>` |
| `APP_BUILD 2, JS_REVISION 12` | `APP_BUILD = 1`, `JS_REVISION = 11` |
| *"10/10 tests, tsc clean"* | true, but of a tree without any of the above |

**The header is the one that mattered.** Build 2 went to TestFlight and Tyler
installed it, so the app on his phone has said **ReceiptSnap** at the top of
every screen since — under an App Store listing called TaxTrail, three weeks
after the rename was reported complete.

**Why nothing caught it.** Every check that ran was consistent with the failure:
`tsc` and the tests passed, because the tree was simply the old one. The canon
was *not* corrupted — `ROADMAP.md` still had the URL scheme and
`expo-document-picker` unticked, and `STATUS.md` still listed restore as
pending. The only artifact asserting the work existed was the commit message.
Checking the roadmap against the repo would have caught it; re-reading the
commit message would not.

**The likely mechanism** is the branch-reset step in the working agreement:
`git checkout -B <branch> origin/main` discards uncommitted work in the tree.
Run after the `mobile/` edits and before staging them, it leaves exactly this —
the canon edits re-applied, the app edits gone, and a commit message written
from intent rather than from the diff.

**Practice, going forward:**

1. **Verify a change from the repo, not from the message that claims it.** For
   anything user-visible, grep the built source. `ROADMAP.md` is the checklist
   worth reconciling against the tree before a build, precisely because it is
   maintained by hand and did not follow the message into being wrong.
2. **`git status` before the reset, not after.** The reset is safe only on a
   clean tree; on a dirty one it is a silent revert.
3. **Grep split across JSX nodes.** `ReceiptSnap` survived two rename sweeps as
   `Receipt<Text …>Snap</Text>`. A rename search must include the bare stems
   (`Receipt`, `Snap`), not just the joined word.

Redone in full today, plus a regression the second attempt adds: restore is
hidden unless `expo-document-picker` is actually present, because JS ships over
the air and can land on a binary compiled without the native module.

---

## D-041

**Parser test data is generated, not collected. Two real bugs on the first run,
one of them silently losing money.**

Date: 2026-08-29 · Status: accepted

Tyler asked whether receipt photos could be pulled off the internet in bulk to
improve the parser. The answer was no, for a reason that is worth keeping:

**Images are the wrong unit.** The corpus is OCR *text*; `classifier.js` never
sees an image. And the OCR is Apple Vision via `expo-text-extractor` — iOS-only,
on-device, not runnable from a CI or agent session. Any image would have to be
OCR'd by a different engine, whose line ordering and error modes differ from
Apple Vision's, so the parser would be tuned against the wrong distribution.
Secondary but real: receipt photos online are mostly licensed stock, and the
genuine ones carry names, partial card numbers and loyalty IDs that must not be
committed to a public repo.

**What replaced it:** `mobile/scripts/synth-corpus.js` generates receipts from
known numbers, so ground truth is a fact rather than a hand annotation — the
one thing scraped images cannot supply. Deterministic from a seed, nothing
written to the repo, scored by `npm run test:synth` against a committed
baseline so it ratchets rather than blocking.

**It paid for itself immediately. Two genuine bugs, both in `MONEY`:**

1. **A printed tax rate was read as the tax.** `TAX 8.25%   3.71` → the parser
   returned **8.25**. `MONEY` matched `8.25` out of `8.25%` before reaching the
   real amount. US receipts print the rate on the tax line constantly, so this
   was wrong on a large share of real input. Fixed by skipping any match
   immediately followed by `%` — while leaving the Bass Pro `$13.98 @ 6.0%`
   taxable-base path alone, which is verified by its own test.

2. **Amounts over $999 without a thousands separator lost their leading
   digits.** `MONEY` began `[0-9]{1,3}`, so `1124.06` matched as **124.06** and
   `12345.67` as **345.67**. A $12,345 equipment purchase would have been
   recorded as $345 — on a tax record, an order of magnitude understated, with
   nothing anywhere reporting an error. Fixed by accepting either a properly
   grouped number or a plain digit run; greedy `[0-9]+` means a match can no
   longer begin midway through a number. **No lookbehind**, deliberately —
   Hermes support is not worth betting the parser on.

Neither is exotic. Both would have hit real users, and neither was going to
surface from five hand-collected receipts.

**Two lessons about the method itself, both learned the hard way in one
session:**

- **An expected value must state what the receipt says, not what you think the
  answer is.** The first hard version scored tips as parser failures. They were
  not: whether a restaurant tip belongs in "the total" is a *product* decision.
  It is now reported in its own bucket rather than buried in the headline number
  — see the open question in `ROADMAP.md`.
- **A corpus that scores 100% has stopped teaching.** The first version passed
  everything, which meant it was only confirming what already worked. The
  formats that found bug #2 were added specifically because the score was
  suspiciously clean.

**Deliberately not claimed:** a synthetic pass does not mean a receipt parses on
device. This generator does not reproduce Apple Vision. Tyler's own receipts
remain the only on-distribution data, and the synthetic corpus supplements them
rather than replacing them.


---

## D-042

**A tip counts toward the receipt total — but only when the receipt prints the
post-tip figure.**

Date: 2026-08-29 · Status: accepted · Tyler's call

Raised by the synthetic corpus (D-041). A card slip prints the pre-tip figure
first and the amount actually paid lower down:

```
AMOUNT CHARGED   288.71
TIP               41.64
AMOUNT PAID      330.35
```

`extractTotal` returned **288.71**. "AMOUNT CHARGED" matches the highest-priority
total hint while "AMOUNT PAID" only matches a lower one, so the pre-tip line won
on priority. For a tax app that means **every tipped meal was under-deducted**.

**The rule is deliberately one-sided.** The tip is added only when the receipt
itself prints the post-tip figure on a total-ish line. Without that confirmation
there is no way to distinguish a pre-tip total from one that already includes
the tip, and guessing wrong *inflates* a deduction — a worse failure than the
one being fixed. Under-reporting an expense costs money; over-reporting it is
the kind of error that matters in an audit, and this app's whole proposition is
records a CPA can trust.

Consequences of that choice, each covered by a test:

- **Printed post-tip line** → tip added. The common card-slip case.
- **Total already includes the tip** → left alone, no double count.
- **Handwritten tip** → nothing printed to add, printed total stands. Correctly
  out of scope; the user edits it if they want the tip captured.
- **Suggested-tip guide** ("15% = 3.00") → ignored. These print plausible
  post-tip totals, which is exactly what would fool a careless rule, so lines
  carrying a `%` or the word "suggested" are never treated as a charge.

**What would change this:** if real receipts turn up where the tip is printed
but no post-tip total is, the conservative rule leaves money on the table and
the trade-off is worth revisiting — with the audit risk stated explicitly, not
assumed away.


---

## D-043

**Gating decisions are pure functions, because both were quietly wrong and
neither was testable.**

Date: 2026-08-29 · Status: accepted

The free-tier limit and the review prompt both lived inline in `CaptureScreen`.
Neither is complicated; both are the kind of rule that stays wrong for months,
because the only way to exercise "what happens on the 11th scan" was to scan
eleven receipts on a phone. They now live in `src/lib/gates.js` as pure
functions with unit tests at the boundaries.

**The review prompt was actually broken.** It read
`countThisMonth() === 3`, which has two defects:

1. **It re-fired every month.** iOS throttles the review dialog to three a year,
   so nothing visibly failed — the app just spent that quota asking users it had
   already asked, instead of asking new ones.
2. **Exact equality against a live count is fragile.** Delete a receipt and the
   count revisits 3. Save two receipts before the check runs and it skips 3
   entirely and never asks at all.

Now: a **lifetime** count (`countAll()`), `>=` rather than `===`, and a
persisted `rs.reviewAsked.v1` flag written *before* the dialog is requested — so
a throw or a silent iOS decline still does not produce nagging on every save.

**The free-tier boundary is now pinned by tests** in both directions. Off by one
either gives away a scan or blocks a user who was promised ten; a malformed or
missing count resolves to "not gated", because failing open costs one free scan
while failing closed locks someone out of the app they just installed.


---

## D-044

**The `NSLocalNetworkUsageDescription` in the generated Info.plist does NOT
ship. Settled — do not re-raise.**

Date: 2026-08-29 · Status: accepted

`npx expo prebuild` produces an `Info.plist` with **five** usage descriptions,
one of which reads:

> Expo Dev Launcher uses the local network to discover and connect to
> development servers running on your computer.

On an app whose differentiator is "Data Not Collected" that looks alarming — a
shipping binary asking for local network access to reach dev servers is exactly
the unexplained permission D-007 warns about. It is also **not what ships.**

`expo-dev-launcher`'s config plugin adds a `PBXShellScriptBuildPhase` whose
script begins:

```sh
if [ "$CONFIGURATION" != "Debug" ]; then
  ...
  # Only delete the description if it matches the dev-launcher default text
  if echo "$DESC" | grep -q "Expo Dev Launcher"; then
    /usr/libexec/PlistBuddy -c "Delete :NSLocalNetworkUsageDescription" ...
```

It strips both that key and the `_expo._tcp` Bonjour service from every
non-Debug build. Production builds are Release, so the shipped binary carries
**four** permissions — camera, photo library, Face ID, location — which is
exactly what the App Review notes in `docs/APP_STORE_LISTING.md` claim.

**Two things to remember from this:**

- **A prebuild `Info.plist` is the source, not the artifact.** The runbook's
  "inspect the generated Info.plist" step is still right, but it sees the input
  to the build, not its output. A key present there may still be stripped.
- **The strip is conditional on the default text.** If anyone ever overrides
  `NSLocalNetworkUsageDescription` with custom wording, the `grep -q "Expo Dev
  Launcher"` no longer matches and the key **will** ship. So do not "fix" this
  by writing a nicer description — that is the one change that would actually
  break it.

Investigated because the review notes list four permissions and prebuild showed
five. The discrepancy was real; the conclusion is that the notes are correct and
the plist is not the last word.


---

## Note on D-035

`D-035` was never issued — it does not appear anywhere in this repo's history.
The gap is real, not a missing file. `D-037` was briefly used twice (the
distribution-certificate correction and the app-icon change); the icon entry was
renumbered to **D-038** and its references in `STATUS.md` and
`mobile/scripts/make-icons.py` updated.

## D-045

**A relaxed money pattern, but only where the strict one found nothing**
(2026-08-29)

Apple Vision routinely puts a space where a decimal point belongs. `costco-1.txt`
contains `POWER VEG      1. 49 A` and `AMOUNT: $140. 35`. The `MONEY` regex does
not match across that space, so those lines contributed **no amount at all** —
not a wrong amount, an absent one, which then fell through to the largest-number
fallback and picked up whatever else was on the receipt.

Measured before fixing: on the synthetic corpus the total was recovered on
**12.6%** of receipts carrying the artifact. After: 100%.

Three ways to fix it were available, and the choice matters:

1. Widen `MONEY` itself to allow the space. **Rejected** — `MONEY` is used in
   six places and its `.source` is reused to build global variants, so widening
   it changes the meaning of lines that already parse correctly today.
2. Pre-process the OCR text to close up `\d\. \d\d`. **Rejected** — it edits the
   evidence. The diagnostics dump would no longer be what the scanner produced,
   which is the one thing that dump is for.
3. **Chosen:** a second pattern, `MONEY_SPACED`, tried only when the strict pass
   returns nothing for that line. Strictly additive: no line that parses today
   can change meaning, because the loose pass never runs on it.

The separator class in the spaced form deliberately **excludes the comma**.
`[0-9]+[.,] [0-9]{2}` would read "Suite 200, 50 Main St" as $200.50 — a comma
followed by a space is ordinary English, a period followed by a space and
exactly two digits is not. Pinned by two tests.

`extractTotal` was also still calling the raw `MONEY` regex directly while every
other call site had moved to `matchMoney`, so it never got the percent-sign
guard from D-041 either. It now goes through the shared `scanMoney`, which is
where both behaviours live.

### The general point, which is the reason this is written down

The synthetic corpus was passing **100% on every axis** when this was found. A
generator the parser aces has stopped doing its job — it is measuring the
generator, not the parser. Both new axes (`spacedCents`, `glyphLabel`) were
copied from artifacts visible in the real corpus rather than invented, and one
of the two turned out to be a real defect while the other was already handled.
That ratio is the point: **when the corpus goes quiet, take the next hard case
from real data, not from imagination.**

## D-046

**Export-format audit: what was wrong, and the one thing that was already
right** (2026-08-29)

Tyler's call to audit every package-specific export before shipping was correct.
A file that fails to import is a support email; a file that imports cleanly with
wrong numbers is a wrong tax return. Findings, each checked against a primary
source rather than recalled:

### TXF sign convention — ALREADY CORRECT, no change

This was the open question with the most at stake, and the answer is that
`buildTXF` was right all along. The v042 spec's definition of the `$` field:
"Income, gains, and money received are positive numbers. Expenses, losses, and
money spent (including tax payments) are negative numbers." The refnum table
carries a per-code `Sgn` column, and every Schedule C expense code TaxTrail uses
is `E`. The spec's own Schedule C example ends `TS / N304 / C1 / L1 / $-668.00`.
Verified against four independent copies of the spec, including a Wayback
capture of Intuit's own first-party page. **Do not "fix" this later.**

### Record format 3 — was wrong, now fixed

Refnum 302 "Other business expense" is Record Format 3, not 1. The changelog
says so in as many words: "RNum 302 changed to Record Format 3". Format 3 is
`$ amount` + **`P description`**, and the spec's example emits one record per
description with an incrementing `L` (N287 on L1, then L2).

TaxTrail merged five categories into a single N302 record and listed their names
in an `X` line. `X` is a *detail-record* field — it appears only on `TD` records
in every example and in GnuCash, and its layout is columnar, beginning with a
space and a date. A bare category name there sits exactly where an importer
parsing columns expects a date. Schedule C line 27 is itemized in Part V, so the
old output also threw away the itemization the format exists to carry.

### Two categories were mapped to the wrong refnum

- **Shipping & Postage → 302** should be **313** (Office expense). The Line 18
  instruction is one sentence: "Include on this line your expenses for office
  supplies and postage."
- **Employee Benefits → 302** should be **308** (line 14). Refnum 308 exists and
  is exactly this. Worse, the app's own category label already said "Line 14 —
  Employee benefit programs", so the exported file contradicted the screen the
  user had just read.

### Schedule C line 27a became 27b for tax year 2025

The IRS swapped the sub-lines: 27a is now the energy-efficient-buildings
deduction (Form 7205) and "Other expenses (from line 48)" moved to 27b. Four
category labels said 27a — correct for TY2024, wrong for the returns being filed
now. The 2026 draft keeps the 2025 ordering, so this is not a one-year blip.

### QuickBooks: the BOM comes off, the date format gets a warning

Column order, negative-for-money-out and the header names are all correct
against Intuit's documented 3-column layout. Two changes:

- **BOM removed from the QuickBooks file only.** It exists on the CPA CSV
  because a human opens that one in Excel, which otherwise sniffs Windows-1252.
  Nobody opens the QuickBooks file — it goes into QBO's parser, where a leading
  BOM can only be read as part of the first header name. Intuit's docs never
  mention BOMs either way, so this is judgement, but it is asymmetric: the BOM
  buys nothing in this file and can only cost.
- **The date format now carries a warning in the UI.** MM/DD/YYYY is accepted
  but Intuit's own guidance recommends dd/mm/yyyy, and QuickBooks asks the user
  to pick at the mapping step. For any day from 1 to 12 both readings are valid,
  so a wrong choice imports **silently** into the wrong month. This is the
  highest-consequence finding in the whole audit precisely because nothing
  fails: a wrong BOM is a greyed-out button, a wrong date format is a clean
  import of wrong data.

Also renamed the export to "QuickBooks Online" (file
`taxtrail-quickbooks-online-<year>.csv`). QuickBooks **Desktop** cannot import
bank transactions from CSV at all — it needs Web Connect `.qbo` — so the old
generic name pointed Desktop users at a file that could never work.

### Deliberately NOT done

Intuit's docs say "Remove numbers from cells in the Description column".
Stripping digits would mangle "7-Eleven" and "Store #1234" into nonsense, which
trades a documented-but-unconfirmed import risk for guaranteed data loss. Left
alone, noted here so the next person does not have to re-reason it.

### Corroborated against a real production file

Beyond the spec, a shipping commercial product's April-2025 TXF export was
retrieved and read (CharityRecord, which documents importing into TurboTax
Desktop and H&R Block Desktop). Its records are literally `TD: N,C,L,$,X` and
`TS: N,C,L,$` — summary records carry no `X` — and its header date is
`D04/15/2025`, zero-padded with no space after the `D`. That is exactly the
shape TaxTrail now emits.

One caveat recorded honestly: the header-date padding is a conformance defect,
not a wrong-return risk. It is the export date, not a tax figure, and the spec's
own later examples use unpadded dates elsewhere, so producers have shipped both.

### Still unverified, and it is the part that matters most

Nobody has imported any of these files into TurboTax, H&R Block, TaxAct or
QuickBooks. Everything above is spec-reading. The byte-exact fixtures in
`__tests__/classifier.test.js` pin the output so it cannot drift, but a fixture
proves the file matches the spec as I read it — not that the importer agrees.
That test needs Tyler or a trial licence and stays open on the roadmap.

## D-047

**Android is parked for launch — but not for the reason anyone assumed**
(2026-08-29)

Android had never been audited. The assumption in the room was that OCR would be
the blocker, since the app is built on Apple Vision. **That assumption is
wrong**, and it is worth writing down so nobody re-derives it:

- `expo-text-extractor` ships an Android implementation. It is not iOS-only.
- Every other dependency has an Android build too, including
  `react-native-document-scanner-plugin`.
- `app.json` already carries an Android package name and an adaptive icon.
- The only `Platform.OS` branches in the whole app are cosmetic — a keyboard
  behaviour and a monospace font name.

So Android is technically plausible today. It is parked anyway, for four
reasons that have nothing to do with feasibility:

1. **The parser is tuned on Apple Vision output, and Android is not Vision.**
   `expo-text-extractor`'s Android build depends on
   `com.google.android.gms:play-services-mlkit-text-recognition`. ML Kit is a
   different engine with different line ordering and different error modes.
   Every fixture in `__tests__/corpus/` is Vision output, and the synthetic
   generator's noise model is built from those same artifacts. **The measured
   accuracy on Android is not "probably similar" — it is unknown**, and the
   corpus that would tell us does not exist.

2. **It is the *unbundled* ML Kit variant**, so the model is delivered through
   Google Play Services rather than shipped in the binary. That means a Play
   Services dependency (no AOSP or Amazon devices) and a first-use network
   fetch. For an app whose entire differentiator is the "Data Not Collected"
   label, that needs a careful answer before it needs a build — not after.

3. **A second store is a second everything**: Play Console account, a separate
   Data Safety declaration, separate RevenueCat products and Play Billing
   configuration, separate screenshots and review process.

4. **Tax season governs.** Installs run ~5x in late January and collapse after
   April 15. iOS has not shipped yet. Splitting attention across a second
   platform before the first one is in the store spends the only window that
   matters.

**Revisit after the iOS launch, and start by collecting an ML Kit corpus** —
the same "Parser diagnostics" export, from an Android device. Nothing else
about Android should be estimated until that number exists.

## D-048

**Sales tax is split by largest remainder, not by rounding each part**
(2026-08-29)

Splitting a receipt across categories splits its sales tax too. The old code
rounded each part independently, which does not add up:

| Tax | Split | Old result | Sum |
|---|---|---|---|
| $1.00 | 3 equal parts | 0.33 · 0.33 · 0.33 | **$0.99** — a cent lost |
| $0.01 | 2 equal parts | 0.01 · 0.01 | **$0.02** — a cent invented |
| $5.00 | 7 equal parts | 0.71 × 7 | **$4.97** — three cents lost |

Losing a cent understates a deduction, which is merely wrong. **Inventing one is
worse**: sales tax flows to Schedule A line 5a, so an over-reported figure is an
over-claim on a filed return. Both accumulate across a year of split receipts,
and neither announces itself — the exported column simply does not sum to the
tax the receipt shows.

Replaced with the largest-remainder method in whole cents (`src/lib/prorate.js`):
floor every part, then hand the leftover cents to the parts with the largest
discarded fractions. The parts always sum to exactly the amount divided, and no
part is more than a cent from its exact share. Ties break by index, so an export
re-run produces the same file — a CPA diffing two exports should see no churn.

Kept as plain CommonJS in `src/lib/` for the same reason as `gates.js` and
`restorePlan.js` (D-043): the Node test harness can require it, so "does $0.01
across two categories stay $0.01" is a unit test rather than an experiment on a
phone. Thirteen tests, including a sweep asserting the parts sum to the whole
across every shape from 1 to 40 cents over 1 to 7 parts.

**The Summary screen now uses the same split.** It was accumulating unrounded
shares and rounding once at the end, which is defensible in isolation and gives
a mathematically exact total — but it would then disagree with the CSV by a
cent, and the CPA reconciling the two has no way to tell which is right. One
number, computed one way.

## D-049

**Splitting a receipt could exceed it, and the screen said otherwise**
(2026-08-29)

Found while hardening a latent issue the export audit flagged as "currently
unreachable". It was reachable, and the path was two lines apart in the same
file.

`addSplit` checked only that the entered amount was positive. Nothing compared
the running total of the splits against the receipt. `save()` then stored the
leftover as `total - sum(allocations)`, so a **$50 receipt split into two $30
parts saved a -$10 allocation**.

The screen actively concealed it. The remainder hint read:

```
Remainder ${Math.max(0, totalNum - allocated).toFixed(2)} stays under "..."
```

The `Math.max(0, ...)` clamped the *display* while `save()` stored the raw
negative — so the app said "Remainder $0.00" at the exact moment it was about
to write minus ten dollars. A user had no way to see the problem.

Downstream, `buildTXF` built its amount as `'$-' + sum.toFixed(2)`, which for a
negative sum concatenated into **`$--10.00`** — a malformed record an importer
cannot read, in the file whose whole job is to be read by other software.
Reproduced before fixing.

Three fixes, because each layer should hold on its own:

1. **`addSplit` caps a split at what is left**, and says how much that is rather
   than silently refusing.
2. **The hint tells the truth.** No clamp; a negative remainder shows as
   negative.
3. **`buildTXF` negates rather than prefixing.** `'$' + (-sum).toFixed(2)`
   cannot produce `$--`, and it gives the *right* answer as well as a
   well-formed one: expense refnums carry `Sgn=E`, so a category that nets to a
   credit belongs on the expense line as a positive number. This is what GnuCash
   does when it calls `gnc-numeric-neg` on the way out.

Layer 3 is not redundant with layer 1. `planRestore` accepts whatever a restored
archive contains, so the exporter cannot assume the UI has already validated the
numbers.

**The lesson worth keeping:** the audit called this unreachable because the
amount fields use `keyboardType="decimal-pad"`, which has no minus key. That was
true and irrelevant — the negative was produced by *subtraction*, not typed. When
a report says a bad value is unreachable, check every arithmetic path that
constructs one, not just the inputs that accept one.

## D-050

**"Meals & Entertainment" is now "Business Meals", and line 20a exists**
(2026-08-29)

Tyler's call, made after the export audit flagged the name as a misnomer.

### The rename

Entertainment has been nondeductible since the TCJA. The 2025 Schedule C
instructions say so twice — "Do not include entertainment expenses on this
line" — and the line is now headed **"Deductible meals"**, not "Meals and
entertainment". A category called "Meals & Entertainment" invites a user to
scan a ballgame ticket into a 50%-deductible bucket, which is the single most
audit-attractive mistake this app could encourage.

The stored `scheduleC` label moved to the form's own wording:
`Line 24b — Deductible meals (50%)`.

Worth knowing, because it is the one case where an entertainment receipt IS
partly deductible: food and beverages bought at an entertainment event count
if they "were purchased separately from the entertainment, or the cost of the
food and beverages was stated separately ... on one or more bills, invoices, or
receipts." That is a receipt-level distinction, so it is a plausible future
feature — but it is a *separately stated line*, not a whole receipt, and the
instructions add "You cannot avoid the entertainment disallowance rule by
inflating the amount charged for food and beverages."

### A rename is a data migration, and it never ends

The category name is a string on every receipt row, inside every allocation,
and inside every exported archive. Three things follow, and all three are
implemented:

1. **Stored rows** — there was no migration mechanism at all, just
   `CREATE TABLE IF NOT EXISTS`. Added a `PRAGMA user_version` runner in
   `db.ts`; each migration is idempotent and runs in a transaction, so a crash
   halfway leaves the version unbumped and the next launch retries.
2. **Archives** — an export made before today keeps the old name forever, and
   people keep backups for years. `restorePlan.normalizeRow` now maps the
   category (and each allocation's category) through `canonicalCategory`, so an
   old archive lands under the new name instead of resurrecting a category that
   no longer exists and would export with **no TXF code at all**.
3. **One source of truth** — `CATEGORY_ALIASES` in `classifier.js`. Both the
   migration and restore read from it, so the next rename is a one-line change
   rather than three.

The migration was run against a real SQLite database (Node 22's `node:sqlite`)
rather than reasoned about: the category is rewritten, the allocations JSON is
rewritten and still parses, the `scheduleC` label refreshes, notes are
untouched, and zero occurrences of the old name survive.

The allocations rewrite is a plain `REPLACE` on the **quoted** JSON form
(`"Meals & Entertainment"`). That is safe because the category is the only
place the old name appears inside an allocation and it is always a quoted JSON
string value — a Schedule C label mentioning the same words is not touched.
Pinned by a test.

### The coverage audit: one real gap, four deliberate ones

Tyler asked whether every IRS line is covered. Checked category-by-category
against the 2025 form. Five Part II lines had no category. Four stay uncovered
**on purpose**, because they are not receipt-shaped:

| Line | Why it stays uncovered |
|---|---|
| 12 Depletion | Mining, timber, oil. No receipt, and not this audience |
| 16a Mortgage interest | Arrives on a Form 1098, not a receipt |
| 19 Pension and profit-sharing | Arrives from a plan administrator |
| 27a Energy efficient bldgs | Needs Form 7205 and a licensed engineer's certification |

**20a was the real gap**, and it is squarely receipt-shaped: renting a lift, a
trencher or a generator produces a receipt you photograph. Added
**Equipment Rental → line 20a**, TXF refnum **299** ("Rent on vehicles, mach,
eq" → `2011:C:20a`, verified in the v042 table).

The instructions split line 20 cleanly, so this is an addition rather than a
re-split: 20a is "vehicles, machinery, or equipment"; 20b is "other property,
such as office space in a building." Every existing `Rent & Lease` keyword is
space (storage unit, coworking, office rent), so that category stays on 20b
untouched — pinned by a test.

**Deliberately not claimed: rental cars.** A car rented while away from home on
business is a travel expense (24a), and Hertz/Avis/Enterprise stay in Travel &
Lodging. Moving trucks (U-Haul, Penske, Ryder) are the genuinely ambiguous case
— a vehicle rental by the letter of 20a, a travel cost in practice — and are
left where they land today rather than moved on a coin flip. **If Tyler wants
them on 20a, that is a keyword addition, not a redesign.**

## D-051

**Three bugs from the first real diagnostics export** (2026-08-29)

Six real receipts, and every one of the three defects was invisible to the
synthetic corpus — which was sitting at 100% throughout. That is the argument
for real data in one line.

### 1. The total was read as the subtotal (the serious one)

A Target receipt prints every label first and every value after, so amounts
line up by **position**, not adjacency:

```
SUBTOTAL
T = VA TAX 6.00000 on $25.00
TOTAL
$25.00      <- belongs to SUBTOTAL
$1.50       <- belongs to the tax line
$26.50      <- belongs to TOTAL
```

"The amount is on this line or the next" handed `TOTAL` the subtotal, and the
receipt exported **$1.50 light** — silently, because $25.00 is a real number
printed on the receipt. A wrong number on a tax record with nothing to notice.

`repairColumnTotal` fires only when a subtotal and tax were both found, the
chosen total equals the subtotal to the cent, **and subtotal + tax appears
verbatim as an amount somewhere on the receipt.** That last condition is what
makes it safe: a genuinely tax-inclusive receipt does not print the sum, so
there is nothing to match and the repair stands down. Pinned both ways.

### 2. A coupon decided the category

The Bass Pro receipt for fishing bait ends with a coupon for the *Islamorada
Fish Company **Restaurant***. That one word filed a bait purchase as a
50%-deductible business meal.

Keywords found only after a promotional marker now score at a quarter weight,
and — the part that actually fixes it — **a category whose entire case rests on
the footer does not qualify at all.** Marketing copy is not evidence of what was
bought. Bass Pro now lands Uncategorized, which asks the user rather than
quietly claiming a meal deduction.

The marker is searched **only in the back half** of the receipt. A real Cabelas
receipt has "NOW HIRING" on line 3; cutting there would discard the purchase.

### 3. The store's name was nowhere on the receipt

The Home Depot receipt opens *"How doers get more done."* — the name never
appears. Merchant parsed as "How doers", nothing matched, Uncategorized.

`sloganBrand()` matches against whitespace-flattened text, because OCR wrapped
the slogan across two lines, and it **overrides** an extracted merchant rather
than merely filling in for a missing one — "How doers" is not a shop. Kept
separate from the `BRANDS` fallback deliberately: brand names get mentioned
incidentally (one corpus receipt has an entire second receipt appended to it),
whereas a slogan at the top is the shop identifying itself.

### Not fixed, because it is a product call

Bass Pro and Cabelas now land Uncategorized. Whether a sporting-goods store
should map to a category by default is Tyler's decision, not a parser bug.

### Also worth recording

The diagnostics export records the stored category but not whether the **user**
changed it, so it cannot distinguish a parser result from a correction. Three of
these six read "Personal (non-deductible)" and there was no way to tell which.
An `edited` flag is agreed and comes next.

## D-052

**A money field bound to a number cannot be typed into** (2026-08-29)

Tyler tried to correct a sales tax to $0.40 and reported that the field "backs
out the 0". It was worse than that.

The receipt edit fields were controlled inputs bound directly to a number:

```jsx
value={selected.salesTax != null ? String(selected.salesTax) : ''}
onChangeText={(v) => setSelected({ ...selected, salesTax: parseFloat(v) > 0 ? parseFloat(v) : null })}
```

Every keystroke went **text → number → text**, and anything not yet a finished
number was erased on the way back. Simulated against the real binding:

```
press 0  -> field held "0"  -> re-rendered as ""
press .  -> field held "."  -> re-rendered as ""
press 4  -> field held "4"  -> re-rendered as "4"
press 0  -> field held "40" -> re-rendered as "40"
final: "40"
```

**Typing $0.40 recorded $40.00 — a factor of 100, silently.** The decimal point
could never be entered at all, on either the total or the sales-tax field, so
every edit of an existing receipt was integer-only. `1.` parses to `1` and
renders as `"1"`, which eats the dot before a user can reach the cents.

Fixed with `MoneyInput`, which keeps the user's raw text while the field is
focused and only falls back to the canonical number on blur. The rules live in
`src/lib/moneyInput.js` as pure functions so "does typing 0.40 give forty cents"
is a unit test rather than something checked by hand on a phone — the same
reasoning as `gates.js` and `prorate.js` (D-043).

Two decisions inside the sanitizer worth stating:

- **`""`, `"."` and `"0."` are legitimately null**, not zero. A receipt with no
  recorded tax is a different claim from one with zero tax, and the difference
  matters on a Schedule A line.
- **Cents truncate rather than round.** Rounding mid-keystroke would change
  digits the user had already typed while they were still typing more.

The capture screen was never affected — it holds its fields as strings. Only
editing an existing receipt was broken, which is exactly where a user goes to
*correct* a number.

## D-053

**Build 4 carries the native modules for work that has not shipped yet**
(2026-08-29)

Tyler has two days of free EAS builds left and wants one now. A native build is
the only moment native modules can be added, so the question is not "what
feature is ready" but "what will we wish were compiled in."

Added, with the SDK 55 versions taken from `expo/bundledNativeModules.json`
rather than guessed — `api.expo.dev` is blocked from these sessions, so
`npx expo install` cannot resolve versions here, but the map ships inside the
`expo` package:

| Module | Version | For |
|---|---|---|
| `react-native-gesture-handler` | ~2.30.0 | swipe-to-delete with real iOS momentum |
| `react-native-reanimated` | 4.2.1 | required by gesture-handler's Swipeable |
| `react-native-worklets` | 0.8.3 | pulled in by reanimated 4 |
| `expo-mail-composer` | ~55.0.16 | the feedback flow's prefilled mail |

**All three React Native packages declare `codegenConfig`**, which RN 0.83
requires — there is no legacy bridge fallback (CLAUDE.md). Verified by reading
each `package.json`, not assumed.

### The trap that would have wasted the credit

Reanimated 4 needs the `react-native-worklets` Babel plugin, and this project
has **no `babel.config.js` at all**. A missing plugin does not fail the build —
it fails at runtime, so the credit is spent on a binary that crashes.

Read `babel-preset-expo`'s shipped source to settle it:

```js
// Automatically add `react-native-reanimated/plugin` when the package is installed.
hasModule('react-native-worklets') && ... ? [require('react-native-worklets/plugin')]
```

The preset adds it automatically when the package is present. **No
`babel.config.js` is needed**, and adding one would risk overriding this.

### GestureHandlerRootView ships with the module, not the feature

`GestureHandlerRootView` must be the outermost view or gesture-handler's
recognizers never receive touches — and the failure is silent, a swipe simply
does nothing. It is wired into `App.tsx` now, with the module, so build 4
carries it and swipe-to-delete can then ship entirely over the air.

Swipe-to-delete itself is deliberately NOT in this build. The binary's job is
to contain the native surface; the behaviour is JS and follows by OTA.

## D-054

**Build 4 failed on a dependency npm chose for us** (2026-08-29)

The build died in `Install pods` with "Unknown error. See logs of the Install
pods build phase" — and **that log lives on expo.dev, which is blocked from
these sessions**, so the error itself was unreadable from here.

What was findable: `react-native-worklets` was installed at **0.8.3** while Expo
SDK 55 pins **0.7.4**.

Nobody chose 0.8.3. It arrived as a transitive peer of `react-native-reanimated`
(which only asks for `>=0.7.0`) when the three modules for build 4 were added.
Their versions were taken from `expo/bundledNativeModules.json` and were
correct — the failure was the fourth package that came in behind them, unasked.

`npx expo install` exists to prevent exactly this, and cannot run here:
`api.expo.dev` is blocked (CLAUDE.md), so packages get added with plain
`npm install` and a hand-copied version. **A hand-check covers the packages you
thought about. It cannot cover the ones you didn't.**

So the durable fix is `scripts/check-expo-pins.js`, run in CI: it walks every
package in `bundledNativeModules.json`, compares against what is actually
installed in `node_modules` (not merely what `package.json` declares), and names
the exact `npm install --save-exact` line to fix each one. Verified by
reintroducing 0.8.3 and watching it fail.

### The allowlist, and why it has to exist

The check immediately flagged a second divergence: `expo-font` resolves to
**57.0.1** at top level against a pin of `~55.0.8`. That one is **fine**, and
proving it mattered more than fixing it:

- `@expo/vector-icons@15` depends on `expo-font@57`, which npm hoists.
- `expo` keeps its own nested copy at the pinned `55.0.8`, so the native module
  the SDK links is the right one; 57 is only a JS consumer of the API.
- The lockfile shows this arrangement is **unchanged since before build 3**,
  which built and shipped.

A check that fails on a proven-good condition blocks every PR, so it carries an
`ALLOWED` map — and the rule for that map is that each entry needs evidence it
has shipped, not a hunch.

### Confirmed (2026-08-29, after the fact)

This was written while the cause was still a hypothesis — the pod log was
unreadable from here. Tyler then pasted it, and it names the cause exactly:

```
[Reanimated] Your installed version of Worklets (0.8.3) is not compatible with
installed version of Reanimated (4.2.1). Please install the latest supported
version of Worklets 0.7.x or older.
[!] Invalid `RNReanimated.podspec` file: [Reanimated] Failed to validate worklets version.
```

The fix had already been pushed by the time the log arrived. Reanimated
validates the worklets version in its **podspec**, so the mismatch is fatal at
pod resolution and never reaches a compile — which is why the failure was fast
and why nothing in the JS could have revealed it.

**Correction to the last line of this entry as first written:** it said build
failures are not charged against the EAS quota. That is only half right. They
draw on a *separate* pool of 10 failed builds a month rather than on the 10
completed builds — cheap relative to a completed build, not free. See the cost
model in `docs/RUNBOOK.md`, corrected 2026-08-30.

---

## D-055

**Read a build's error code, not just its status** (2026-08-30)

Build 4 took three submissions. Two failed, eleven minutes apart, and from a
Claude Code session they looked identical — the CLI reported a failure, and the
reason lived on expo.dev, which is blocked from here (CLAUDE.md).

They were not the same failure at all:

| Build | Code | Cause |
|---|---|---|
| `c5adc37f` | `UNKNOWN_ERROR` | `Install pods` — the worklets pin (D-054). **Our fault.** |
| `167f871b` | `SERVER_ERROR` | "Failed to upload application archive" — Expo's own infrastructure. **Not our fault.** |

The second one is the interesting case. The CLI surfaced only
`Network error: Service Unavailable / Response status: 503`, which reads like
the request never landed. It had: EAS recorded a build, marked it ERRORED, and
charged it against the failed-build pool. Judging by the CLI output alone, the
worklets fix looked like it had been tested and failed. It had never run.

**`eas build:list --json` carries `error.errorCode` and `error.message`** for
every build, and it is reachable from CI. It was already being called by the
workflow's `usage` step, which printed status and threw the error away. It now
prints it. Free, ~60 seconds, no approval needed.

The rule that follows:

- `SERVER_ERROR` → Expo's infrastructure. **Retry as-is.** Nothing in the diff
  is implicated, and treating it as a code failure sends you debugging a change
  that was never executed.
- anything else → it happened on the worker. **The diff is at fault.**

### What was tried and rejected

The first version of this also printed whether the build had reached a worker,
derived from `metrics.buildStartTimestamp`. `build:list --json` does not return
`metrics`, so it printed "never started on a worker" for a build whose own error
message said `See logs of the Install pods build phase` — confidently wrong
about the exact question it existed to answer. Removed rather than repaired: the
error code already separates the two cases, and a diagnostic that lies is worse
than no diagnostic, because it is believed.

---

## D-056

**Exports say what they cover, and are named for it** (2026-08-30)

Every export took ALL receipts while being named for the CURRENT year:
`taxtrail-2026.csv` could hold three years of data, and last year's return could
not be exported at all. Exporting twice produced the same filename twice, which
iOS resolves by appending "(1)".

Tyler asked for "export all, or just year to date, or an entire year".

`exportRange.js` holds the range logic, and the range decides **both** what goes
in the file and what the file is called:

```
taxtrail-2025-exported-2026-08-30.csv
taxtrail-2026-ytd-exported-2026-08-30.txf
taxtrail-all-exported-2026-08-30.xlsx
```

Coverage first so a folder sorts by tax year; the export date spelled out with
"exported" rather than merely appended, because `taxtrail-2025-2026-08-30` reads
as two ranges and nobody can tell which is which.

The export functions filter their own input rather than trusting the caller to.
A caller that passed the range for the filename and forgot to filter would
produce a file labelled "All of 2025" containing everything — the exact bug this
feature exists to fix, one layer up.

### ISO strings, never Date objects

`new Date('2026-01-01')` parses as **UTC midnight**, which is 2025-12-31 in every
US timezone. A Date-based year filter therefore drops New Year's Day receipts
for every American user — the entire market. Comparing `yyyy-mm-dd` strings
lexicographically has no timezone to get wrong. Demonstrated rather than
asserted: the naive version puts 2026-01-01 in 2025 under `TZ=America/Los_Angeles`,
and the suite is run under four timezones in CI.

### Undated receipts are reported, not dropped

A receipt with no date is not "outside 2025", it is unplaceable. Every bounded
range returns it separately and the UI says so, because silently dropping a row
from a tax export is how a deduction goes missing.

### Two things this turned up

- **A custom range would have crashed the XLSX export.** SheetJS *throws* on a
  worksheet name over 31 characters (verified, not assumed), and
  `Summary 2026-01-01 to 2026-06-30` is 32. Harmless while the label was always
  a four-digit year. `safeSheetName` falls back to the bare prefix rather than
  truncating to `Summary 2026-01-01 to 2026-0`, which reads as a corrupt file.
- **A ranged archive is not a backup.** Its README used to end "Keep this file
  somewhere durable"; for a partial range it now says, in as many words, that it
  is not a full backup and how to get one.

---

## D-057

**`edited` is derived from what the parser said, not tracked** (2026-08-30)

Tyler asked for an `edited: true` flag in the diagnostics export. The flag alone
answers "was this row touched". What the parser needs is "touched HOW", because
a corrected receipt is a labelled training example and an uncorrected one is not.

So a receipt stores `parsedSnapshot`: the classifier's own output, frozen at scan
time, before the merchant-memory override and before any keystroke. The flag is
then **derived** — no bookkeeping to fall out of sync — and diagnostics can emit
the pair that actually fixes a parser bug:

```
"parserSaid": { "total": 25.00, ... },
"stored":     { "total": 26.50, ... },
"edited": true, "editedFields": ["total"]
```

That is Tyler's real Target correction. The OCR text plus the right answer is
everything a regression fixture needs, so a scanning session now produces
labelled data instead of anecdotes.

### null, not false

A row scanned before the snapshot column existed reports `edited: null`.
Backfilling a snapshot from the current values would assert the parser got them
right, which is the one thing there is no evidence for — and it would silently
inflate every future accuracy measurement. The diagnostics summary counts
`corrected` / `unedited` / `unknown` as three separate things for the same
reason.

### What is not compared

Notes (never parsed) and `taxRate` (four possible sources: printed, city memory,
derived, last used). A difference in either says nothing about the parser.
Merchant compares case- and whitespace-insensitively, and money compares in whole
cents — a sub-cent float difference is not a user correction, and flagging it
would bury the real ones in noise.

---

## D-058

**Settings is its own tab, and the destructive control lives there** (2026-08-30)

Manage Subscription sat in the EXPORT card, between "Full JSON backup" and a note
about QuickBooks date formats. Tyler said he could not find it. He was right:
export is a workflow, and subscription, restore and deletion are settings.

The fourth tab holds subscription, restore-from-archive, about, developer
options and a danger zone.

### Three things came out of building it

- **There was no Restore Purchases control at all.** The only one lived inside
  the fallback paywall, which is shown *only* when RevenueCat's remote template
  fails to load — so in the normal case there was none. Apple requires one
  (Guideline 3.1.1); this is a review rejection as much as a user problem.
  `restorePurchases()` is now exported and on the Settings screen, and it says
  what happened either way, because silence after tapping Restore is
  indistinguishable from a broken button.
- **Delete-all removes the images too.** Deleting rows alone would leave every
  photograph in the documents directory while telling the user their data was
  gone. For an app whose whole claim is "it never leaves your phone", being
  wrong about deletion is the worst available failure. Rows go first: orphaned
  images are invisible and recoverable, rows pointing at deleted images show up
  as broken thumbnails in a tax record.
- **Two confirmations, and the second one names the number.** The first alert is
  the tap people make while reading. The copy points at the archive export,
  because that is the difference between a user who meant it and a user about to
  lose a year of records.

### The developer gate

The JSON backup and the diagnostics dump moved behind seven taps on the version
stamp. Both are useful to Tyler and misleading to everyone else — the JSON backup
records image *paths*, which go stale on reinstall, so it looks like a backup and
is not one. Hidden rather than removed: they are how parser bugs get fixed at all.

Taps were chosen because Tyler is usually phone-only and terminal paste does not
work on his phone. The counting rules live in `devMode.js`, pure, so "seven taps
unlocks it" is a unit test rather than something verified by tapping a phone
seven times — including that a pause resets the count, so it cannot be triggered
by idle scrolling.

**The version stamp stays in the Summary footer.** It is one of Tyler's standing
rules and it drifted silently once already (D-039), so it is not a thing to
relocate on a tidiness argument. Settings carries a second copy for the tap
gesture; both call `versionStamp()`, so they cannot disagree.

---

## D-059

**Feedback goes through the system Mail composer, and that is what keeps the privacy label** (2026-08-30)

Tyler wanted a feedback control with a checkbox for attaching receipt data, and
asked whether we want the images: *"If we don't need their receipt images, it's
fine to only get the raw OCR text and parsed fields, but I suspect we actually do
want the images."*

We do — a photo usually shows why a receipt read badly when the text alone does
not. The question is whether receiving any of it adds rows to the App Store
privacy label, which is the entire product pitch.

**Correction (2026-08-30):** as first written this entry said the label is
"Data Not Collected". It is not, and has not been since D-022 — RevenueCat
forces a Purchase History row, so the label is **"Data Not Linked to You —
Purchases only"**. The reasoning below is unaffected: the thing to protect is
that the label carries *purchases and nothing else*, and receipt data would add
rows far beyond it. The wrong phrase came from `CLAUDE.md`, which still carried
the pre-D-022 claim; that has been fixed at the source.

### What Apple actually says

Checked against `developer.apple.com/app-store/app-privacy-details` rather than
recalled. Data is **optional to disclose** only if it meets **all four**:

1. not used for tracking — not linked with third-party data for advertising or
   measurement, not shared with a data broker;
2. not used for third-party advertising, our advertising or marketing, or
   "Other Purposes";
3. *"Collection of the data occurs only in infrequent cases that are not part of
   your app's primary functionality, and which are optional for the user"*;
4. *"The data is provided by the user in your app's interface, it is clear to the
   user what data is collected, the user's name or account name is prominently
   displayed in the submission form alongside the other data elements being
   submitted, and the user affirmatively chooses to provide the data for
   collection each time."*

Apple names this exact case: *"data collected in optional feedback forms or
customer service requests that are unrelated to the primary purpose of the app
and meet the other criteria above."*

### Criterion 4 is why this is not an HTTP POST

An in-app upload to a support endpoint would satisfy 1–3 and **fail 4**. There is
no account name to display, and "affirmatively chooses each time" is weak when
the app is the thing doing the sending.

The system Mail composer satisfies it directly: *it is the submission form*. It
shows the user's own address in the From field, the body, and every attachment by
name, and nothing leaves until they tap Send. TaxTrail has no account and no
name to display — the user's own email address in the composer is the closest
true equivalent, and it is Apple's own UI presenting it.

So the design follows from the criteria rather than from taste:

- every attachment defaults to **off**, ticked individually, every time;
- each is named in plain words on the checkbox — the diagnostics option says
  "text only, no photos", which is the difference between someone attaching
  receipt text and believing they attached pictures;
- the body **restates what was attached**, so criterion 4's "clear to the user
  what data is collected" holds in the sent artifact, not only in a screen they
  have already dismissed;
- the app never sends; it opens the composer and stops.

### Report from the receipt, not from Settings

A report opened on a specific receipt carries that one receipt's text and photo.
That is the pair that fixes a parser bug. A general report from Settings would
otherwise carry every receipt on the device, most of which scanned fine — worse
for us to read and far worse for the person sending it.

### The size cap

8 MB, against a ~20–25 MB provider limit. A bounced support email is a **silent**
failure: the user tapped Send, watched it leave, and nothing arrived. Images are
attached newest-first until the budget is spent, and anything left out is
reported in the confirmation rather than dropped quietly.

---

## D-060

**Swipe-to-delete reveals, then confirms** (2026-08-30)

Tyler: *"It's totally fine to add a dependency if that makes it look and feel the
best."* It did not need one — `react-native-gesture-handler` and
`react-native-reanimated` both went into build 4 for exactly this (D-053), so
swipe-to-delete ships over the air with nothing new.

Uses `ReanimatedSwipeable`, gesture-handler's own implementation, which tracks
the finger on the UI thread through reanimated instead of crossing the JS bridge
every frame. That is the difference between "native" and "a list that lags".

**Import path:** `react-native-gesture-handler/ReanimatedSwipeable`. It is *not*
re-exported from the package root — the root exports the older `Swipeable`. The
subpath was verified to resolve (`require.resolve`, then a real Metro bundle)
before the component was written, rather than assumed from the docs.

### Reveal, tap, confirm — three steps on purpose

iOS Mail deletes on swipe with an Undo, which is the nicer interaction. Undo is
not available here: `deleteReceiptFiles` removes the JPEG, a receipt image is the
substantiation for a deduction, and there is no server copy to restore from — by
design. Photos confirms for the same reason, and this follows Photos, not Mail.

The confirmation names the merchant and the amount, so it informs rather than
merely obstructs. Cancelling re-closes the row: without that the row sits open
behind the dismissed alert, looking like the delete is still pending.

`overshootRight` is off. Rubber-banding past a destructive action suggests that
swiping further will delete, and here it will not. `rightThreshold` is raised to
40 from the default half-action-width, which on an 88pt action opens on almost
any horizontal movement — including the diagonal drift of a vertical scroll.

---

## D-061

**Light theme follows the system, and the palette's contrast is a test** (2026-08-30)

Tyler approved this despite a recommendation to defer it — 178 `T.*` references
across ten files.

### The mechanical part

`StyleSheet.create` runs once at module load, so a themed screen cannot keep its
styles at module scope. Every file got the same three edits:

```
  import { T } from '../lib/theme'   ->  import { styled, useTheme }
  const s = StyleSheet.create({…})   ->  const makeStyles = styled((T) => ({…}))
  (inside the component)             ->  const T = useTheme(); const s = makeStyles(T);
```

Done with a script rather than by hand, because ten identical edits done by hand
is ten chances to get one wrong, and `tsc` plus a real Metro bundle is the check
that they landed. `styled()` memoises per palette, and there are exactly two, so
a screen builds its styles at most twice for the life of the process.

`T` is still exported as the dark palette, so anything not yet converted keeps
working rather than failing at runtime.

**No in-app toggle.** iOS already has that setting and it is where people look
for it; an app-level override is one more thing to keep in sync for no benefit.
`useColorScheme` returns null before the value is known, and dark is the default,
because that is what the current binary and every screenshot look like.

### The part that mattered

The light palette is not the dark one inverted. `line` had to become a black
alpha — a white hairline on a white card is invisible, which would have silently
removed every border in the app — and `accent`, `danger`, `warn` and `good` all
had to darken to stay readable on white.

Getting that right by eye is not possible, so `scripts/check-contrast.js`
computes WCAG 2.1 ratios from the palette itself, flattening alpha onto the
background first (every `line` and `accentSoft` token has some). It found, on
its first run:

- **`#fff` title text on the fallback paywall.** On the light palette's near-white
  background that is invisible — on the purchase screen. It was hardcoded, so
  the theme conversion alone would not have caught it.
- **The danger-zone border and the Delete button border** hardcoded as the *dark*
  palette's red. Now a `dangerLine` token.
- **`muted2` at 2.85:1** in light, under the 3:1 bar for secondary text.
  Darkened to `#7f899c`.

### The baseline, and why the dark theme is not "fixed"

The check also found **five pairings in the DARK palette below the WCAG target**,
shipped that way for months — including white-on-accent at 3.71:1 on the primary
button, and white-on-danger at 2.78:1.

Those are Tyler's brand colours and a real design decision. Quietly restyling the
shipped app so a new script passes would be the wrong way round. So the check is a
**ratchet against a committed baseline, exactly like the synthetic parser corpus
(D-041)**: a palette that gets worse fails, one that is merely imperfect does not.
The five are printed as warnings on every run so they stay visible.

The LIGHT palette carries no baseline — it is new, so it meets the targets
outright, and it does.

**For Tyler:** those five dark-theme ratios are worth a decision, not a fix I
should make alone. White on `#4f7cff` clears WCAG's 3:1 large-text bar but not
the 4.5:1 body-text one, and the button label is 15–16px. Darkening the accent a
little would fix it and change the app's signature colour.

---

## D-062

**Never add a native module ahead of the feature that uses it** (2026-08-30)

Build 4 crashed on launch, on Tyler's only phone, and the cause was a decision
recorded approvingly in D-053: add `react-native-gesture-handler`,
`react-native-reanimated`, `react-native-worklets` and `expo-mail-composer` now,
because "a native build is the only moment native modules can be added — so the
question is not what feature is ready but what we will wish had been compiled
in."

That reasoning is wrong, and this entry supersedes it.

### What actually happened

`App.tsx` imported `GestureHandlerRootView` at module scope purely to pre-wire
swipe-to-delete, a feature that had not shipped. Importing gesture-handler drags
**Reanimated's entire runtime** in with it: build 4's bundle contains
`NativeReanimated` 87 times despite nothing in the app importing Reanimated.
Something in that graph threw during bundle evaluation.

The crash log is conclusive. `SIGABRT` on `expo.controller.errorRecoveryQueue`,
`-[NSException raise]` four frames into the app binary. That is
`ErrorRecovery.crash()` in expo-updates, which builds its exception name from
`RCTFatalExceptionName` and reads `RCTJSStackTraceKey` — a React Native **JS**
fatal error. The `JavaScript` and `hades` threads are both alive in the report,
so Hermes started and evaluated the bundle before it threw.

Removing the import takes the bundle from 1178 modules to **752**.

### Why it was terminal rather than annoying

expo-updates has a recovery pipeline — fetch a newer update, launch it, else
fall back to an older working one, else crash. A **fresh install has only its
embedded bundle**, so there is nothing for any step but the last. The user is
stuck until they reinstall, which is not something you can ask of someone who is
asleep or away.

### The second, worse mistake

The same `main` would have destroyed **build 3**, the only working fallback.
Build 3 has neither gesture-handler nor `expo-mail-composer`, and `main`
statically imported both. `runtimeVersion` policy is `appVersion`, so every
update reaches every v1.0.0 binary. One `eas update` would have taken out both
builds at once and left no working install anywhere.

That is the failure this entry exists to prevent, and it was one dispatch away.

### The rules

1. **A native module goes in the build that ships the feature using it.** Spare
   capacity in a build is not a reason to add one. An unused module is not free
   — it is untested weight in the startup path, and this one was fatal.
2. **A binary is not shipped until it has been observed to launch.** Building,
   signing, uploading and passing Apple's processing test none of that. Say
   "built", not "shipped", until a device has run it.
3. **Any module not in every live binary must never be statically imported.**
   Reach it through a guarded require inside a function and hide the control
   when it is absent — `isRestoreAvailable()` in `exportShare.ts`.

Rule 3 is now mechanical: `scripts/check-ota-safety.js` keeps a committed record
of what each live binary was compiled with, scans every static import the bundle
can reach, and fails CI on a mismatch. It was verified by running it against the
unfixed tree, where it named both landmines and the files importing them.

### What this cost, and what to do differently

Tyler lost a night to it and had to fetch a crash log from his phone. Two things
would have prevented it outright: not adding the modules (rule 1), and the CI
check (rule 3). A third would have caught it earlier — treating "it built" as
progress rather than completion (rule 2).

The airplane-mode test that was run mid-diagnosis is worth recording as a trap.
It **cannot** distinguish a JS fault from a native one: with no network,
recovery steps (a) and (b) are unavailable and a fresh install has nothing for
(c), so *any* startup fault ends identically. It was read as evidence of a
native cause and sent the diagnosis the wrong way for an hour.

---

## D-063

**A shop's own domain names it better than its header does** (2026-08-30)

Scoring the real corpus showed 6 of 9 receipts flagged, and the obvious reading —
"the categorizer is weak" — was wrong. Totals, tax and dates were correct on all
nine. **The merchant was the broken field**, and the bad category was downstream
of it, because `classify()` takes the merchant as a signal.

What the parser was producing:

| Receipt | Merchant |
|---|---|
| Cabela's | `All Ammo And Firearm Sales Are Final` |
| Target | `Glen Allen Broad St - 804-360-8900` |
| Costco | `Bw Yai Grup` |
| Bass Pro | `Bass` |
| Safeway | `Safeway €).` |

That is the string a CPA reads on the export, and the key merchant-memory
fingerprints on. A disclaimer line is not a merchant.

### The fix

`BRAND_MARKERS`: a domain or proprietary programme name only one retailer
prints. It overrides an extracted merchant, like `SLOGANS` and unlike `BRANDS`,
because a header line that reads like a street address is weaker evidence than
the shop's own domain.

Two details make it safe, and both came from the corpus rather than from
imagination:

1. **The earliest match wins.** The Target receipt has an entire second receipt
   appended: `cabelas. com/careers` sits at line 43, after `target circle` at
   line 27. Any-match would have named it Cabela's. Earliest-match names it
   Target, because a shop identifies itself before anything else on the paper.
2. **Dots match through OCR spacing.** The real Cabela's receipt reads
   `CABELAS. COM/CAREERS`, so the text is flattened with `\s*\.\s*` → `.`
   before matching.

Result: Bass Pro, Cabela's, Target and Safeway all resolve correctly, Target's
confidence rises from low to medium, and no total, tax or date moved.

### What was deliberately NOT fixed

Both Costco receipts. OCR mangled the name to `Bw Yai Grup` and `Howat Kai #1`,
and the domain appears nowhere in either — there is no marker to match. The
available "fix" would be pattern-matching the street address, which is inventing
evidence, and it would fire on any other shop at that address.

They are left wrong on purpose. The user corrects the merchant once and
`memory.ts` recognizes the store by fingerprint afterwards — that is the
mechanism that already exists for this, and it is better than a guess. There is
a test asserting Costco is NOT resolved, so nobody "improves" it later by
matching an address.

### On the metric

The triage score counts `uncategorized` as a flag, which made a correct
behaviour look like a defect. Bass Pro and Cabela's stay Uncategorized even now,
and that is right: whether a battery from a sporting-goods shop is a business
supply is not something the receipt can answer. Flagging it for review beats
guessing on a tax return. **Read the per-receipt output before chasing the
number** — the number pointed at the categorizer and the bug was in the merchant.

---

## D-064

**No cloud OCR, for MVP or for Pro. And the learning loop already exists** (2026-08-30)

Tyler asked three things on 2026-08-29 that were never answered:

> "how can we make the parser intelligent and able to continuously learn…
> Dare we allow pro users the ability to enhance recognition with cloud
> services?… do we use Cloudflare R2? or am I getting way too ahead of myself
> for our MVP launch?"

**Yes, too far ahead for MVP — but the cloud question deserves a real answer,
because it is not a scaling decision. It is the product.**

### Cloud OCR costs the label, and the label is the product

The App Store privacy label is currently one row: **Data Not Linked to You —
Purchases only** (D-022). That single row against Keeper, QuickBooks and Wave —
which carry identity-linked financial data used for advertising — is the entire
differentiator.

Sending receipt images or OCR text to a server for recognition does **not**
qualify for Apple's optional-disclosure exemption. The criteria are in
`src/lib/feedback.js`, quoted from Apple; the one that kills it is:

> "Collection of the data occurs only in **infrequent cases that are not part of
> your app's primary functionality**, and which are optional for the user."

Scanning receipts IS the primary functionality. So cloud OCR must be disclosed,
and what gets disclosed is not a small row: a receipt carries **Purchases**,
**Financial Info**, often **Location** (the store address) and, on a business
meal, arguably **Sensitive Info**. The label would go from one row to four or
five, and the marketing comparison collapses.

Gating it behind Pro does not help. The label describes the app, not the tier.
An app that *can* upload receipts discloses that it uploads receipts.

### It also would not buy much

The OCR engine is Apple Vision, and it is good. What limits accuracy is the
image handed to it — D-051 and D-063 were both failures of *interpretation*, not
of character recognition: a total read from a stacked column, a merchant read
from a disclaimer line. A cloud model would have read the same characters.

Where a cloud model would genuinely help is semantic classification — deciding
whether a Bass Pro battery is a business supply. But that is a question about
**Tyler's user's business**, which no model can answer from the receipt, and
which the app already handles correctly by flagging it for review (D-063).

### The learning loop that already exists

"Continuously learn" is the right instinct and two thirds of it already ships:

1. **Merchant memory** (`memory.ts`) — Dice-similarity fingerprints over the OCR
   text with a street-number gate. Correct a merchant once and that store is
   recognized afterwards. This is what makes the unfixable Costco receipts
   (D-063) a one-time annoyance rather than a permanent defect.
2. **`parsedSnapshot`** (D-057) — every receipt freezes what the classifier said
   before the user touched it. A correction is therefore a **labelled training
   pair**: OCR text in, right answer out. The diagnostics export emits them as
   `parserSaid` next to `stored`.

That second one is new and it changes what a scanning session produces. It is
already how D-063 was found.

**The missing third is not a model, it is a pipeline**: getting those pairs off
the device and into `__tests__/corpus/` regularly. That is the highest-value
parser work available, it needs no cloud, and it is bounded — the diagnostics
export already produces the file.

### On Cloudflare R2

R2 is object storage. Nothing in this product needs it. `taxtrail.app` is
already on Cloudflare Pages and email routes through Cloudflare (D-029) — that
is the right amount of Cloudflare for an app with no
servers. Adding a bucket means adding the thing the product exists to not have.

### Decision

- **No cloud OCR**, MVP or later, unless the positioning changes deliberately —
  in which case it is a marketing decision made first and a technical one
  second, exactly like D-022's closing note.
- **Learning stays on-device**: merchant memory plus snapshot-derived fixtures.
- **Revisit only if** real corpus data shows Apple Vision itself failing on
  characters, rather than the parser failing on interpretation. That has not
  happened once in nine real receipts.

---

## D-065

**A receipt's own vocabulary can name a shop that never prints its name**
(2026-08-30)

### Context

D-063 fixed merchants by reading the shop's domain off the receipt, and closed
by recording Costco as unresolvable: OCR mangled the header to "Bw Yai Grup" and
"Howat Kai 1", no domain appears, and guessing from the street address would be
inventing evidence. A test was written to pin that — so nobody would "fix" it by
pattern-matching an address.

That reasoning was sound and the conclusion was still wrong, for a reason that
only shows up if you look at what a Costco receipt actually prints. **It does
not print "Costco" anywhere.** The header is the warehouse location. There is no
name on the paper for OCR to have mangled, so no amount of header work would
ever have recovered it — the corpus was not showing a hard OCR problem, it was
showing that the evidence lives elsewhere on the page.

### Decision

Add a third merchant source, ranked between the domain markers and the header
guess: a **structural fingerprint** over terms the chain prints and others do
not. For Costco: the `whse:` / `Trm:` footer fields, "TOTAL NUMBER OF ITEMS
SOLD", and "INSTANT SAVINGS".

**Two markers must match.** This is the whole safety argument, and the corpus
supplies the counterexample rather than intuition: Safeway prints "TOTAL NUMBER
OF ITEMS SOLD" too. On a one-marker threshold, every Safeway receipt in the
world would have been renamed Costco. That is now a unit test in its own right,
so a future marker addition cannot quietly lower the bar.

Ranking matters as much as the threshold. A slogan or a domain is the shop
identifying itself and still wins. A fingerprint beats `extractMerchant`,
because a header line that reads like a street address is a weaker signal than
four fields of the chain's own receipt format.

### What it costs, and what it does not

Naming the merchant also settles the category — "costco" was already a General
Merchandise keyword — so the real corpus goes from 4 clean of 9 to 6. The three
still flagged are Bass Pro and Cabela's. Their merchants read correctly; their
*category* is unresolved, and that is left alone deliberately. A rod and reel is
deductible for a charter operator and not for anyone else, so the app asking is
correct behaviour, not a defect. Category keywords for ambiguous retailers are
Tyler's call, not a parser fix.

### The rule worth keeping

**"OCR could not read it" and "it was never printed" look identical in a
diagnostics dump, and they need opposite fixes.** Before hardening a reader,
check that the thing being read exists on the page. Both prior attempts here
went into the header because that is where a name usually is.

---

## D-066

**Build 4 asks for Face ID and Location, and the app has neither feature**
(2026-08-30)

### What was found

`expo-local-authentication` and `expo-location` are in `package.json`, are
configured as plugins in `app.json` with hand-written purpose strings, and are
compiled into build 4. **No file in `mobile/src/` or `App.tsx` imports either
one.** There is no app lock and no mileage log. Neither permission prompt can
ever appear, because nothing ever asks.

The App Review notes in `docs/APP_STORE_LISTING.md` described both as shipping
features — "Face ID — optional app lock", "Location (when in use) — optional
mileage logging" — and D-044 checked the permission list against the generated
`Info.plist` and found it correct.

### Why it survived two checks

Both checks were real and both were of the same kind. D-007 compared the plist
against the plugin config. D-044 compared the notes against the plist. The
config, the plist and the notes agreed with each other, so each check passed.
**Nothing compared any of them against the code**, which is the only place the
answer lived.

The permissions are not an accident either — D-006 added them to the dev client
deliberately, noting that GPS mileage "needs `expo-location` compiled in", and
recorded that the surface would be trimmed in the production build. That trim
never happened; build 4 became the production build with the dev client's
permission set.

### Decision

The notes are corrected now: they list camera and photo library, and carry an
explicit instruction not to paste the other two back. That part needs no build
and is done.

**What to do about the binary is Tyler's call, and it is one of two things:**

1. **Drop both plugins in build 5.** Smallest permission surface, which is the
   product's whole argument. Costs nothing extra — build 5 is already planned
   for swipe-to-delete — but forecloses GPS mileage without another build.
2. **Ship the features that justify them.** Both modules are already compiled
   into build 4, so the Face ID app lock and GPS mileage are **OTA-shippable
   today** — no build, no credit. This corrects D-006's note, which said GPS
   mileage needed a build: it needed the module compiled in, and it now is.

Not decided unilaterally, because it is a product question — whether TaxTrail
is an app with an unlock screen and a trip log — not a cleanup.

### Do not submit before this is resolved

An unexplained permission on an app whose entire pitch is restraint is the
corrosive thing D-007 was written to prevent, and this is that, arrived at from
the other direction: not a permission nobody disclosed, but a permission
disclosed for a feature nobody wrote.

### The rule worth keeping

**A claim about behaviour has to be checked against code at least once.**
Config, manifests and docs can agree perfectly and all be wrong together —
they are copies of an intention, not observations of a program. `grep` for the
import is the check that would have caught this on day one, and it takes a
second.

---

## D-067

**Build 5 is mandatory before submission — every fresh install of build 4
crashes on its first launch** (2026-08-30)

### The finding

Build 4's embedded bundle is **js r22**, and r22 is the bundle that crashed.
Verified directly rather than inferred: `git show fba11d5:mobile/src/lib/
version.ts` reads `JS_REVISION = 22`, and `git show fba11d5:mobile/App.tsx`
still has `import { GestureHandlerRootView } from 'react-native-gesture-handler'`
at line 6 — the exact import D-062 identified as fatal.

The OTA fix does not save a new install, because of *when* the bundle loads.
Read out of the installed `expo-updates` rather than from memory:

- `launchWaitMs` defaults to **0** — `UpdatesConfig.swift` ends its parse with
  `?? 0`, and `UpdatesConfiguration.kt` has
  `UPDATES_CONFIGURATION_LAUNCH_WAIT_MS_DEFAULT_VALUE = 0`. `app.json` sets no
  override; its `updates` block is a URL and nothing else.
- `AppLoaderTask.swift:158` — `if launchWaitMs == 0 || !shouldCheckForUpdate {
  isTimerFinished = true }`, then `loadEmbeddedUpdate { self.launch { ... } }`.

So the embedded bundle launches **immediately** and the remote update is fetched
alongside it, for the *next* launch. On a fresh install the first launch is
r22, and r22 aborts.

This is the same mechanism Tyler saw on 2026-08-29, when he deleted and
reinstalled build 3 and the footer read `build 3 · js r12` — an update that had
long since been published. It was recorded then as a shrug for a TestFlight
tester. It is not a shrug now: r12 merely ran an old parser, and r22 does not
run at all.

### What it means

- **Every new TestFlight tester Tyler adds today gets a crash on first launch.**
  His own install works only because it has been running since before the OTA.
- **Build 4 cannot be the submitted binary.** The App Store review device would
  be a fresh install, and so would every user's.
- **The recovery pipeline gives it five seconds, and that is the whole margin.**
  `ErrorRecovery.swift` runs `waitForRemoteUpdate -> launchNew -> launchCached
  -> crash`, and `RemoteLoadTimeoutMs = 5000`. On a JS fatal it fires
  `loadRemoteUpdate()` and waits 5s. Win that race and it relaunches into r25
  and the user sees a stall; lose it and `launchCached` finds nothing on a
  fresh install, so the next step is `crash()`.

  So the honest version of "every fresh install crashes" is: **every fresh
  install has five seconds to download the entire bundle or it crashes** — a
  coin flip on cellular, and the review device gets the same coin. It is also
  why the symptom will not reproduce reliably: on fast Wi-Fi it looks like a
  slow first launch, on a train it looks like a dead app. That is worse to
  diagnose than a clean crash and no better to ship.

### Decision

**Build 5 is a submission blocker, not the optional convenience STATUS called
it.** It was already planned to carry swipe-to-delete; its actual job is to
embed a bundle that launches. Everything else that wants to ride along —
whatever D-066 decides about the unused permissions, and Tyler's capture-screen
pick — should go in the same build, because this is the one that has to happen.

`buildNumber` to **5** in `mobile/app.json` and `APP_BUILD` to 5 in
`mobile/src/lib/version.ts`, same commit. Add build 5 to `LIVE_BUILDS` in
`scripts/check-ota-safety.js` only once it has been *observed to launch*
(D-062 rule 2).

### The rule worth keeping

**An OTA fixes the installs you already have, never the next one.** The
embedded bundle is the binary's floor and only a build can raise it. Any time a
crash is fixed over the air, the fix is a stopgap and the build is the repair —
say so at the time, because "fixed" reads as finished.

---

## D-068

**Moving trucks are Schedule C line 20a, and the line is drawn by purpose, not
by wheels** (2026-08-31)

### The question

U-Haul, Penske and Ryder had been open since 2026-08-29 as "a vehicle rental by
the letter of 20a but a travel cost in practice", and were left alone rather
than moved on a coin flip.

### What the research says

The Schedule C instructions for line 20a are the whole answer, and they are not
ambiguous: *"If you rented or leased vehicles, machinery, or equipment, enter on
line 20a the business portion of your rental cost."* Line 24a is scoped to
travel **away from home**, and Pub. 463's travel chapter is about trips, not
about hiring a vehicle to do a job.

So the distinction is **what the rental is for**, not what it has wheels on:

- Hire a car while away from home on business → **24a Travel**. Hertz, Avis and
  Enterprise stay exactly where they are.
- Hire a vehicle to move inventory, equipment or materials → **20a**. A box
  truck across town is not an overnight trip.

Both rules come from the same principle, which is why this is not a coin flip
and why the two merchant sets belong on different lines.

### It was not "left where it lands" — it was being misfiled

Checked rather than assumed, by reverting the change and re-running:

- `U-HAUL … ENV COVERAGE` → **Insurance (line 15)**, on the word "coverage"
- `PENSKE … 26FT BOX` → **Office Supplies**, on "box"
- Ryder and Budget Truck → Uncategorized

The roadmap recorded this as a tolerable ambiguity. It was actually two silent
wrong answers on a tax line, which is worse than Uncategorized in every way.

### Every brand keyword is scoped, because every brand has a sibling

The first version used the bare brands and a code review caught what that
breaks. Each of these is a real business that would be misfiled:

| Bare keyword | What it would also catch | Correct line |
|---|---|---|
| `u-haul` | U-Haul **self-storage**, one of the largest US operators | 20b Rent & Lease |
| `penske` | Penske **Automotive Group** dealerships | 9 Car & Truck |
| `ryder` | Ryder fleet management and logistics | varies |
| `budget` | Budget **Rent A Car** | 24a Travel |

A merchant-name hit carries 3x weight, so a bare `u-haul` outscores
`self storage` and moves a recurring storage bill onto the wrong line. All four
are now scoped to the rental arm (`u-haul truck`, `u-haul moving`,
`penske truck`, `ryder truck`, `budget truck`), with the generic operational
terms (`moving truck`, `box truck`, `cargo van rental`) carrying the rest.

The price is that a receipt whose OCR yields only "U-HAUL" lands Uncategorized.
That is the right trade: the app asking is a known state, and filing a storage
unit as equipment rental is a wrong answer delivered silently.

### The rule worth keeping

**A brand is not a category.** Large brands run several businesses on different
Schedule C lines, so a keyword that is a company name needs the arm attached.
The test file now pins the sibling case for each one.

---

## D-069

**Capture screen: the rectangle is the button, and the meter is free-tier only**
(2026-08-31)

Tyler picked concept A with concept C's recent list, from the four mockups
delivered 2026-08-30.

- **One big dashed target, no second button.** The old screen had a tappable
  hero *and* a "Scan Receipt" button doing the same thing, which made the large
  one read as decoration. The rectangle is now the only scan control.
- **A free-scan meter, for the free tier only.** `freeScanMeter()` in
  `gates.js` returns `null` for Pro, deliberately rather than as an edge case —
  a paying user has nothing to count and "3 of ∞" is a worse screen.
- **The bar fills as the month is spent.** The first version filled it with the
  fraction *remaining*, which made the exhausted bar 0% wide — the one state
  the warning colour existed for was the one state it could not render.
- **`exhausted` delegates to `isOverFreeLimit`** rather than restating the
  boundary. Two copies of "when does the free tier end" is how a screen comes to
  say "1 left" while the paywall fires.
- **Recents sort by `createdAt`, not `date`.** `allReceipts()` orders by the
  user-editable date field, so a receipt scanned now but dated last June sorts
  to the bottom and never appears — which reads as a failed save.
- Tapping a recent row **opens that receipt**, rather than dropping the user on
  an unscrolled list.

### GPS mileage: not now, but the room stays

Tyler's call, and the reasoning is his: a GPS trip tracker "seems like a
different app", though the TaxTrail name does lend itself to it eventually and
the export machinery is the obvious dovetail.

**So `expo-location` stays in build 5.** This is the one place D-066's
"unjustified permission" finding is answered by keeping the module rather than
dropping it: the whole value of leaving it compiled in is that mileage can then
ship over the air, with no build, whenever it is wanted. That is a deliberate
trade of one unused permission string for future optionality, made with the
cost known.

### Face ID stays; expo-camera goes (resolved 2026-08-31)

Tyler applied the same reasoning to **Face ID**: `expo-local-authentication`
stays compiled in, so an app lock can ship over the air later. A privacy-first
receipt app with a lock screen is on-brand, and the module being present is the
whole difference between "an OTA away" and "a build away".

**`expo-camera` is removed in build 5.** It is the one of the three that
optionality does not justify: the camera permission it asks for is already
earned by `expo-image-picker` and the document scanner, so keeping it buys no
future feature — it was dead native weight. Removed from `app.json` and
`package.json`.

So D-066 is now closed. Two permission strings ship without a feature behind
them, both deliberately, and `check-permissions.js` states the reason on every
run rather than calling them a baseline to be paid down.

---

## D-070

**Build 5 crashes too, which falsifies the build 4 diagnosis** (2026-08-31)

### What happened

Build 5 was cut specifically to fix the launch crash, on the reasoning in D-067:
build 4 embedded js r22, r22 aborted on evaluation, and an OTA could not rescue
a binary that never got far enough to apply one. Build 5 embeds js r26 instead.

Tyler installed it. **It crashes exactly the same way.**

### What that rules out

- **Not the embedded bundle.** r26 was exported and inspected here: it bundles
  clean at 752 modules, and a dev-mode export grepped for
  `NativeReanimated`, `react-native-reanimated`, `react-native-worklets`,
  `WorkletsModule`, `createSerializable` and `installValueUnpacker` returns
  **zero matches for all six**. The JS carries no Reanimated at all.
- **Not the `GestureHandlerRootView` import** (D-062's stated cause). It has not
  existed in `main` since r23, and build 5 was compiled from a tree without it.
- **Not a version mismatch.** `react-native-reanimated` 4.2.1,
  `react-native-worklets` 0.7.4 and `react-native-gesture-handler` 2.30.1 all
  match what Expo SDK 55's `bundledNativeModules.json` expects.
- **Not the OTA.** r26 was published from commit `f49d6a6` — the same commit
  build 5 was compiled from — so the embedded bundle and the channel head are
  byte-identical JS.

### Where that leaves it

The cause is something **build 4 and build 5 share and build 3 does not**. The
delta is four native modules added in build 4: `react-native-gesture-handler`,
`react-native-reanimated`, `react-native-worklets` and `expo-mail-composer`.
Three of those are still compiled into build 5 with nothing in the JS using
them — Reanimated 4 and Worklets do native-side JSI installation at launch
regardless of whether any JS imports them.

That is a hypothesis, not a finding, and it is not to be acted on until a crash
log says so. **The crash log is the only thing that has ever been conclusive
here** (D-062), and the mistake being repeated is reasoning from a bundle that
looks correct to a device that has not run it.

### The mistake worth naming

D-062 read a crash log correctly — a JS fatal during evaluation — and then
attributed it to the one JS change that looked guilty. The fix was shipped as
r23, r24 and r25, and **no device ever confirmed any of them**, because build 4
could not get far enough to apply an update. Three revisions were called fixes
on the strength of a smaller bundle and green unit tests.

**A cause is not established by removing something and watching the tests pass.
It is established by a device running the result.** D-062 rule 2 says exactly
this about builds; it applies just as hard to a diagnosis.
## D-071

**Make the app report the error instead of aborting** (2026-08-31)

### What the build 5 crash log establishes

- `build_version: 5`, so it is the right binary. TestFlight agrees.
- `EXC_CRASH / SIGABRT`, `abort() called`, on the
  **`expo.controller.errorRecoveryQueue`** — expo-updates' `ErrorRecovery`
  raising an uncaught NSException, which is its designed last resort.
- **Alive for 361 ms.** That number matters: `RemoteLoadTimeoutMs` is 5000, so
  the pipeline did not wait for a remote update. It asked, was told there is
  nothing newer — correctly, because build 5 embeds r26 and r26 *is* the
  channel head — dropped `launchNew`, found nothing cached on a fresh install,
  and aborted. The mechanism is fully explained.
- The `com.facebook.react.runtime.JavaScript` thread is parked in its run loop
  and `hades` is alive, so Hermes started and the bundle evaluated.

### What it does not establish

**Nothing about what the error actually was.** The abort destroys the message.
No JS revision since r21 has ever been observed to run on a device — the
channel itself labels r21 "last bundle proven to run on device" — so r23, r24,
r25 and r26 were all shipped as fixes for an error nobody has read (D-070).

### The native surface was ruled out first

Comparing every static import across the whole startup graph at r21 against
HEAD, the only external module that appears is **`expo-mail-composer`**, and
that is the guarded `require` inside a function in `FeedbackComposer`. The set
of native modules reachable at startup is otherwise **identical** to the tree
that is proven to run. So this is the app's own JavaScript, not a missing or
newly added native dependency.

### The change

`index.tsx` (was `index.ts`) wraps startup in three nets, because the crash
could come from three places and only one of them was previously catchable:

1. **`require('./App')` in a try/catch** — a module-evaluation throw. `require`
   rather than a static import on purpose: a static import is hoisted and would
   run App's whole module graph before the try block exists.
2. **An error boundary** — a throw during the first render.
3. **`ErrorUtils.setGlobalHandler`** — an async rejection or native callback
   after the first render. This is the one the evidence points at: a JS thread
   parked in its run loop at 361 ms looks like a fatal raised *after* mount, and
   neither of the other two nets can see it. The handler swallows fatals
   deliberately — a broken app that can say why beats a dead one that cannot —
   and passes non-fatals through to the previous handler.

Each renders a full-screen, scrollable, selectable report. The formatter was
tested against `Error`, a bare string, `null`, `undefined` and a plain object,
because a handler that throws while reporting a throw is worse than no handler.

### This is temporary

It is on `main` rather than a rescue branch because `main`'s JS currently does
not launch at all, so a build that can describe its own failure is strictly the
better state.

**Exit condition, corrected 2026-08-31 (D-072):** this originally said "it comes
out the moment the fault is known". That is too early, and read literally it
would have stripped the net the same day it earned its keep. The fault is now
known — expo-font at the wrong major — but the *fix* for it is an `overrides`
pin that needs **build 6**, and build 6 is a native change that could surprise
us exactly as builds 4 and 5 did.

So: **the net comes out once build 6 has been observed to launch on a device**,
not before. Removing it earlier trades the only instrument we have against a
class of failure that has now happened twice.

### The rule

**An app whose startup can fail needs a way to say why.** Three revisions were
spent guessing at an error that the process was busy destroying. The cost of
this net is a few dozen lines; the cost of not having it has been four days.

---

## D-072

**The crash was `expo-font` compiled at the wrong major, and my own pins check
waved it through** (2026-08-31)

### The error

The r27 diagnostic did its job on the first launch:

```
Error: Cannot find native module 'ExpoFontLoader'
    at requireNativeModule (...)
```

`ExpoFontLoader` is `expo-font`'s native module. `@expo/vector-icons` imports
`expo-font` at module scope, `App.tsx` imports `@expo/vector-icons/Ionicons`,
so the throw happened while the module graph was still evaluating — before
anything could render, and before any error boundary existed. That is the
361 ms abort, exactly.

### Why the module was missing

Two copies of `expo-font` were installed:

| copy | version | why |
|---|---|---|
| `node_modules/expo-font` | **57.0.1** | `@expo/vector-icons` peer-depends on `expo-font >=14.0.4`, so npm hoisted the newest |
| `node_modules/expo/node_modules/expo-font` | 55.0.8 | `expo` pins `~55.0.8` |

**Autolinking compiles the hoisted one.** Verified, not assumed —
`expo-modules-autolinking resolve -p apple` reports
`packageVersion: "57.0.1"` with the podspec at the top-level copy. So the binary
carried expo-font 57's native code built against expo-modules-core 55. It
linked, it built, it signed, it passed Apple's processing — and at runtime the
module never registered.

Nothing in the toolchain objects to this. A cross-major native module is not a
build error; it is a runtime absence.

### The part that is mine

`scripts/check-expo-pins.js` had an explicit allowance for this, which I wrote:

> "@expo/vector-icons@15 depends on expo-font@57, which npm hoists to the top
> level; `expo` itself keeps its own nested copy at the pinned 55.0.8, **so the
> native module the SDK links is the right one** and 57 is only a JS consumer of
> the API. This exact arrangement was in the tree for build 3, which built and
> shipped, **so it is proven rather than assumed**."

Both halves are wrong.

1. **"the native module the SDK links is the right one" is backwards.**
   Autolinking takes the hoisted copy, not the nested one. One command would
   have shown that; I reasoned instead.
2. **"built and shipped, so it is proven"** conflates *built* with *ran* — the
   same error as D-062 rule 2, committed in the very file meant to catch
   dependency problems.

A check with an exemption written from a guess is worse than no check: it
converts an open question into a settled one, and it did that for four days
across two native builds.

### The fixes

**Native (needs build 6):** an `overrides` entry pinning `expo-font` to
`55.0.8`. Verified locally: one copy installed, and autolinking now reports
`packageVersion: "55.0.8"`.

**JS (ships over the air, today):** `src/components/Icon.tsx` reaches Ionicons
through a guarded require and falls back to text glyphs when the font module is
absent. Deliberately self-healing — the moment a binary has a working
`ExpoFontLoader`, the require succeeds and real icons return with no follow-up
change to make or remember. Tested in Node against both binary states.

**The guard:** `check-expo-pins.js` now fails on any package that autolinks a
native module and is installed at more than one version. The old allowance list
is empty and the comment explains why it must stay that way. Verified by
running the check against build 5's actual shipped `package-lock.json`, where it
fails naming `expo-font 55.0.8 and 57.0.1`, and against the fixed tree, where it
passes.

### The rules

- **Duplication, not drift, is the native hazard.** A pin check compares the top
  level against a pin. It cannot see the same package present twice at different
  majors, which is the arrangement that actually breaks a binary.
- **An exemption needs a device, not an argument.** "It built" is not evidence
  that it runs. Before writing another entry in `ALLOWED`, name the device.

---

## D-073

**Build 6 failed in Install pods; the expo-font pin is the suspect and the log
is unreadable from here** (2026-08-31)

### What happened

Build 6 (`3625d12d`) errored 72 seconds in:

```
code:    UNKNOWN_ERROR
message: Unknown error. See logs of the Install pods build phase for more information.
```

Everything before it passed: expo-doctor, prebuild, credentials, and the
build-number guard. It failed at CocoaPods.

### RESOLVED 2026-08-31: it was the CocoaPods CDN, not the pin

Tyler pasted the Install pods log. The last lines before the failure:

```
Adding spec repo `trunk` with CDN `https://cdn.cocoapods.org/`
[!] CDN: trunk URL couldn't be downloaded:
    https://cdn.jsdelivr.net/cocoa/Specs/6/a/1/PurchasesHybridCommonUI/13.5.0/PurchasesHybridCommonUI.podspec.json
    Response: 400 400: Bad Request
pod install exited with non-zero code: 1
```

**jsDelivr returned a 400 for RevenueCat's podspec.** Infrastructure, not this
diff. `PurchasesHybridCommonUI` comes from `react-native-purchases-ui`, which
the change never touched — and pod install had already completed autolinking,
codegen, and the React Native and Hermes artifact downloads before it reached
the trunk spec repo. It was far past anything expo-font could affect.

**The suspicion below was wrong. It is left standing rather than deleted,
because being wrong in a named, checkable way is the point of writing it down.**
The reasoning was sound as far as it went — the lockfile diff really was two
lines, and CLAUDE.md really does warn that a version mismatch dies in Install
pods. But "the only thing I changed is the only candidate" quietly ignores
everything a build does that I did not change. **A generic error message plus a
recent change of mine is not a causal link.**

This is also the exact case the babysit rule carves out for a retry: an error
naming a service the diff does not touch. One retry is the right response — and
that only became knowable by reading the log instead of reasoning about it.

### Why the pin looked like the suspect (superseded — see above)

The lockfile diff against build 5 — which built, shipped and launched — is
exactly two lines:

```
- node_modules/expo/node_modules/expo-font   55.0.8   (removed)
~ node_modules/expo-font   57.0.1 -> 55.0.8
```

Nothing else moved. So the `overrides` pin is the only candidate, and CLAUDE.md
already names this shape: "a native dependency at a version this Expo SDK was
not built with is how a build dies in Install pods".

### Why it is not yet proven

The same generic message appears once before in the build list —
`c5adc37f`, 2026-08-29 — and that one had a *different* cause (a
`react-native-worklets` version npm pulled in, fixed by the pins check in #80).
So "Install pods UNKNOWN_ERROR" is a category, not a diagnosis. The podspec
itself looks ordinary: `s.dependency 'ExpoModulesCore'` with no constraint, the
same source files as 57.0.1, and the same registered module names.

**The actual error is in the Install pods phase log, which lives on expo.dev —
the one host these sessions cannot reach** (CLAUDE.md). So the reason is
written down in exactly the place the agent debugging it cannot look.

### Decision (made, and carried out)

**No second build until that log has been read.** Retrying on an
`UNKNOWN_ERROR` is guessing, and guessing is what turned a one-line dependency
fault into four days. Tyler opens the build URL; it is one tap and it ends the
question.

Build 5 with js r28 is working in the meantime, so nothing is on fire — the
only cost of waiting is text glyphs instead of icons.

### On the credit

EAS records 9 builds this month, 4 ERRORED. Failed builds are not charged
(D-015), so this attempt should not have consumed one — but that is EAS billing
policy rather than something the CLI asserts, so it is worth a glance at the
billing page rather than an assumption.

### The rules

- **When the only copy of an error is somewhere you cannot read, stop and get
  it.** The alternative is a retry loop that spends credits to re-observe a
  message nobody has looked at. This worked: one paste ended a question two
  builds could not have.
- **Your own recent change is not evidence.** It is the first thing to check
  and the easiest thing to over-weight. Suspecting it is fine; concluding it
  without reading the error is how D-062 happened, and this came close to
  repeating it.

---

## D-074

**Build 6 launches. The startup net stays, as a product surface** (2026-09-02)

### Build 6 is the first binary that launches unaided

Tyler installed build 6 from TestFlight and it opened: footer reads
`js r28`, and the icons are real Ionicons rather than the text-glyph fallback.
That is the end-to-end confirmation of D-072 — the `overrides` pin makes
autolinking compile expo-font at the SDK 55 major, so `ExpoFontLoader` registers
and `@expo/vector-icons` imports cleanly.

It also makes build 6 the first binary since build 3 whose **embedded** bundle
runs. Builds 4 and 5 needed an OTA to become usable, which meant a fresh install
died before it could fetch one. Build 6 is therefore the first submittable
binary.

Build 6 is now in `LIVE_BUILDS` (commit `4676b73`, same module set as build 5),
satisfying D-062 rule 2.

### `check-ota-safety.js` had three holes, and its own configuration was two

**It was not reading the entry point.** Its file list said `index.ts`; D-071
renamed that file to `index.tsx` and nothing updated the list, so for four
commits the one file that runs *first* was the one file the check skipped.
Nothing had slipped through, but the check could not have known that. It now
walks the project and names what it EXCLUDES — the same skip set as
`check-permissions.js`, which never had this bug because it was written that way
round. Anything added from here on is included by default.

**`PURE_JS` was not true.** The list is documented as "packages that ship no
native code", and it contained `expo` — which *is* the native SDK — and
`@expo/vector-icons`, which depends on expo-font, **the very module whose native
half took builds 4 and 5 down**. A static `import … from '@expo/vector-icons'`
in a new screen would have been waved straight through by the guard whose job is
to catch exactly that. Both are now listed as present in every live binary,
which is the honest way to say it and keeps the list meaning what it claims.

With it comes a limit worth stating: **this check answers presence, not
correctness.** Build 5 had expo-font in the binary and still crashed on it,
because it was the wrong major. `npm run test:pins` is the check for that; the
two are not interchangeable.

**`export … from 'pkg'` was invisible.** The pattern matched a leading `import`
only, so a re-export in a barrel file — hoisted and evaluated identically —
never reached the comparison. Both forms are caught now, and `import type` is
skipped, since it is erased before the bundle exists.

The first attempt at that widening was itself wrong, and review caught it with a
reproduction rather than an opinion: a lazy `[\s\S]*?` between the keyword and
`from` wanders across lines, so `export type Foo = …` sitting two lines above an
import **swallowed that import** and was then discarded as a type — a real
native import, gone, check still green. The same wander read
`// pulled from 'somewhere'` as an import and failed CI on a code comment. The
middle is now newline-, semicolon- and quote-free, braces are flattened first so
multi-line named imports still match, and comments are stripped before any of it
runs. Four probe cases were run against the real script to prove each one.

**The lesson inside the lesson:** the fix for a guard that was too narrow made it
too wide, in a way that fails silently in one direction and noisily in the
other. A guard change needs its own reproduction, not a reading.

The lesson is the usual one: **a check that silently narrows its own input still
reports green.** This is the second time in three days that a guard's own
configuration was the hole (the other was the pins-check allowance list, D-072),
and both times the configuration asserted something that was simply not true.

### The net stays, and stops being a diagnostic

D-071's exit condition — "the net comes out once build 6 has been observed to
launch" — is now met. It is not being taken out.

The reason to remove it was that a full-screen stack trace is not something to
put in front of a stranger. That is an argument about the *presentation*, not
about the nets. So the presentation changed instead:

- Plain headline, `TaxTrail couldn't start`, and a sentence that says the
  receipts are safe on the device and to force-quit and reopen. Someone who has
  never seen a stack trace can act on that.
- The trace, `when`, and the version stamp live behind **Show technical
  details** — still selectable, still complete.
- The stamp is read through a guarded require and deliberately carries **no
  build number**. It was hardcoded as `build 5 · js r27`; the obvious fix was
  `versionStamp()`, and that is wrong for a subtler reason — `APP_BUILD` is a JS
  constant, so an OTA pushes it to every live binary and a build-5 phone would
  report "build 6". A bundle can only tell the truth about its own JS revision.
  Guarded, not imported, because a static import in this file would run outside
  the very nets the file exists to provide.
- `when` and the stamp stay **visible** rather than moving behind the toggle.
  The likeliest thing a non-technical user does is screenshot the screen, and a
  screenshot without those two is the report that cost four days.
- The headline reads `TaxTrail hit an error` on the post-startup path. "Couldn't
  start" is a lie after ten minutes of scanning.

### The bug the rework found

The `ErrorUtils` handler raised the full-screen report for **non-fatal** errors
too. Its own comment said non-fatals "behave normally", and the code did pass
them to the previous handler — but it also fired the crash screen, unmounting a
healthy app. Any library reporting a soft exception could have replaced a live
session, taking an unsaved scan in the review form with it.

That was survivable while the net was a two-day diagnostic on Tyler's phone.
D-074 makes it permanent and ships it to strangers, so it had to be fixed:
non-fatals now go to the default handler and nowhere else. **Making something
permanent is the moment to re-read it as if it were new** — the standard it was
written to was "tell me what crashed tonight", not "be in the App Store".

### The price of keeping the message, and what pays it

Not re-throwing a fatal is not free, and it is worth naming rather than
discovering later. `previous` is the chain that reaches expo-updates'
`ErrorRecovery`, which is what rolls a crashing binary back to its last good
bundle. Swallowing the fatal to render it gives that up: a bad OTA would leave
every phone on the crash screen rather than automatically reverting.

Keeping the message is still the right trade — the rollback needs a cached good
bundle to exist, which a fresh install does not have (that is exactly how D-067
became terminal), and four days say what an unreadable crash costs. But the
recovery is now offered instead of merely lost:

- **A "Check for an update" button** on the crash screen: `checkForUpdateAsync`,
  `fetchUpdateAsync`, `reloadAsync`, through a guarded require, with a plain
  sentence for "nothing new yet" and for "couldn't reach the service".
- It is a shortcut, not the main instruction. `checkAutomatically` is ON_LOAD,
  so force-quit-and-reopen already fetches a fix on one launch and applies it on
  the next. The button turns two launches into one tap.

**Known limit, accepted:** a fatal still unmounts the app, so a scanned receipt
sitting unsaved in the review form is lost. Keeping a tree that just threw
mounted underneath an overlay risks a re-throw loop, and the window is narrow.
If it ever needs fixing, persist `pending` rather than keeping the tree alive.

The three nets themselves are unchanged, and they are cheap: a try/catch, an
error boundary, and an `ErrorUtils` handler. What they buy is not hypothetical —
their first launch produced the message that ended a four-day crash. Shipping to
the App Store is precisely when startup failures stop being observable, because
the person holding the phone is not Tyler and will not send a crash log.

**New exit condition: none.** This is permanent. If it ever needs to go, that is
a fresh decision with its own reason.

### Two smaller things review found in the same pass

- **The photo-library button could be double-fired.** `startScan` awaits the Pro
  check, the paywall and the picker before `busy` hides the controls, so two
  taps meant two paywalls or two pickers. It mattered less when the control was
  13pt of muted text; it is a 48pt button now. Guarded with a ref.
- **The crash screen's palette was outside `check-contrast.js`.** It hardcodes
  its own colours (the theme is app code, and app code is what just failed), and
  the ratios were asserted in a comment. The script parses that literal now, so
  the assertion is a check — and it reported the real figures, which the comment
  had understated.

### The rule

**An app whose startup can fail needs a way to say why — and the way it says it
is a product decision, not a debugging one.** A diagnostic that is only fit for
its author gets deleted before launch, which is exactly when it is worth most.
Make it fit for a stranger and it survives.

---

## D-075

**Receipt photographs are stored by relative path** (2026-09-02)

### The bug

Tyler installed build 6, and the Receipts tab showed every receipt with no
photograph. Nothing had been deleted, and the change that shipped alongside it
touched no image code.

iOS gives an app a Data container whose path contains a UUID:

```
file:///var/mobile/Containers/Data/Application/<UUID>/Documents/receipts/x.jpg
```

**That UUID is not stable.** Apple's File System Programming Guide says the
container may be relocated between launches, and installing a new build is the
common way it happens. The files move with the container; only the path
changes. Every receipt row held the absolute path under the *previous*
container, so the app was looking for the photographs at last week's address.

This has been latent since the first build that stored an image. It was
invisible while there was only ever one install.

### The fix

- **A stored path is a fact about the app; an absolute path is a fact about
  this launch**, and the two must not be confused. `receipts/x.jpg` is the
  right thing to store, and r30 reads it.
- **r30 still writes the absolute form**, deliberately. See below.
- `src/lib/paths.js` holds the rules, pure and unit-tested in node, the same
  split as classifier.js and gates.js. `src/lib/images.ts` is the two lines of
  it that need `documentDirectory`.
- **`resolveImage()` repairs a stale absolute path at the moment of use**, so
  Tyler's existing receipts render again on the first launch of r30. Nothing
  has to migrate first.
- Every read site goes through it: both screens, the archive export, and
  `deleteReceiptFiles` — that last one matters, because deleting a stale path
  silently leaves the real file on the device while telling the user it is
  gone, which for this app is the worst thing to be wrong about.

### The migration that is deliberately NOT here

The obvious companion change is a migration that rewrites every row to the
relative form. It was written, and then taken out before shipping — and with it,
the switch to writing relative paths for newly scanned receipts, which review
caught as setting exactly the same trap for every receipt scanned from now on.

An OTA reaches binaries that can fall back to an older bundle. Build 6 embeds
js r28, which has no `resolveImage` — hand it `receipts/x.jpg` and it renders
blank thumbnails and, worse, `deleteReceiptFiles` deletes nothing while
reporting success. So a one-way data change that only the newest JS can read is
a trap set for the exact recovery path this project has already used twice
(D-062, D-067).

And it buys nothing urgent: the resolver already fixes what Tyler can see.
**The rewrite waits until r30 has been observed on a device and a binary embeds
it** — the same rule as `LIVE_BUILDS` (D-062 rule 2), applied to data instead of
native modules.

`check-ota-safety.js` does not cover this. It answers "can the old bundle find
the native module", not "can the old bundle read the new data". That gap is
worth naming: **an OTA can break an older bundle through the database, not just
through imports.**

So r30 reads both forms and writes the old one. It is not the end state, it is
the state that is safe while three bundles are live. `ROADMAP.md` carries the
follow-up with its unblocking condition: a binary that embeds r30.

### What made it hard to see

The failure looks like data loss and is not. Nothing in the diff that shipped
with the build was near it, so the natural next move — read the change and find
the mistake — had nothing to find. What identified it was the one fact that
was different about that launch: a new container.

### Found by review, not by testing

Two more sites were wrong and neither would have raised an error:

- **FeedbackComposer was left behind.** It passed a stored path to
  `getInfoAsync` and to the attachment list, so every scan-problem report would
  have arrived with no photographs while telling the user it attached them. That
  is the feature's entire purpose.
- **`storedPath` guessed.** A path outside the receipts directory came back as
  `receipts/<basename>`, naming a file that does not exist. It returns null now:
  refusing is better than a confident wrong answer, especially for the caller
  that deletes.

`npm run test:paths` exists because of the first one. Both forms are `string`,
so TypeScript cannot tell them apart, and the failure is always silent.

### The rule

**Never persist an absolute path on iOS.** Store what is stable, resolve at
use. If a path in a database contains a UUID, it is already broken; it just has
not been reinstalled yet.

---

## D-076

**No em dashes in anything the user reads** (2026-09-02)

Tyler's rule, in his words: an em dash is fine "in lists and things like that"
and nowhere else. He counted two on the capture screen and does not want to see
them in the app at all.

Every user-facing sentence is rewritten with a full stop or a comma; a label
and its value are separated by `·`, which the app already used for the version
stamp and the receipt subtitle.

**Two structural exemptions, and they are not a matter of taste:**

- The `scheduleC` labels in classifier.js are the IRS's own line names in a data
  table (`Line 24a — Travel`) — the label case the rule allows. They are also
  copied onto every receipt row and into every CSV, XLSX and TXF export, so
  rewording them is a data migration rather than a copy edit.
- `exporters.js`'s `ascii()` names the characters because its job is to strip
  them.

`npm run test:prose` enforces it, in CI. A wording preference is exactly the
kind of rule that decays: the next screen gets written from memory, and nobody
notices until Tyler does. Comments are not scanned, deliberately — they are
written for whoever maintains this, not for the user.

---

## D-077

**An in-app appearance switch: System, Light, Dark** (2026-09-02)

This overturns a decision that was never written down as one. `useTheme` said:
"Follows the OS rather than offering an in-app switch. iOS already has that
setting, it is where people look for it, and an app-level override is one more
thing to keep in sync with no benefit."

Tyler asked for the switch, and the reasoning above is wrong for this app. It is
used at a restaurant table in the evening and at a desk in the morning, and
changing the whole phone's appearance to read one receipt is not a thing anyone
does. Plenty of shipped apps carry this control for the same reason.

### Two things move, not one

1. `useTheme()` returns the chosen palette, which repaints the app.
2. **`Appearance.setColorScheme()`**, which sets `window.overrideUserInterfaceStyle`
   and is what makes the SYSTEM surfaces follow: alerts, the keyboard, the share
   sheet, RevenueCat's paywall. Without it, a light-mode app raises black alert
   dialogs, and that reads as a bug rather than a theme.

### "System" is dark until build 7, and that is a plist fact

`app.json` had `userInterfaceStyle: "dark"`, which becomes `UIUserInterfaceStyle:
Dark` in `Info.plist` and pins the window's trait collection. With it set,
`useColorScheme()` returns 'dark' on a phone set to Light, so "System" cannot
work. Verified in the RN source rather than assumed: `RCTAppearance.mm` reads
the trait collection, and `setColorScheme` writes `overrideUserInterfaceStyle`,
which is why Light and Dark work immediately and System does not.

The value is now `"automatic"`, and it reaches a device with the next native
build. Until then, choosing System gives dark, and the Settings copy says so
rather than promising something the running binary cannot do.

**Light and Dark on build 6 are expected to work and are not verified.** A
window-level `overrideUserInterfaceStyle` is documented to win over the
app-level plist value, and that is the whole basis for the claim. UIKit trait
resolution is not something this environment can run, and CLAUDE.md is explicit
that reasoning is not verification. It is one tap for Tyler to settle.

### The rule

**A theme switch that leaves the system surfaces behind is half a theme
switch.** The palette is the visible part; the window override is the part
people notice only when it is missing.

---

## D-078

**Brighter greys in the dark palette** (2026-09-02)

Tyler reads the app in low light and found the grey text hard going. He is
right, and the numbers agree.

| Token | Was | Now | On the app background |
|---|---|---|---|
| `muted` | `#8a97ab` | `#9aa6b8` | 6.53:1 -> 7.85:1 |
| `muted2` | `#5b6678` | `#78849a` | 3.33:1 -> 5.13:1 |

`muted2 on card2` was one of the five ratios baselined below the WCAG target
(D-061). At 4.19:1 it now clears the 3.0 target outright, so it comes off the
baseline and is checked normally. **Four baselined ratios remain**, all of them
about the accent and danger colours, which are Tyler's brand and a separate
decision.

The hierarchy survives, which is the thing worth checking when brightening
secondary text: `text` is 16.45:1, `muted` 7.85:1, `muted2` 5.13:1. Each step is
still visibly dimmer than the one above it.

Light mode is untouched. The complaint was specific to reading in the dark, and
the light palette already meets every target.

---

## D-079

**A Face ID app lock, on by default** (2026-09-02)

`expo-local-authentication` has been compiled into every build since build 3
with a purpose string describing a feature that did not exist. That is half of
D-066, the open submission blocker. This is the feature, and it is worth having
on its own merits: the app holds a year of financial records on a device other
people pick up.

### The shape of it

- **On by default**, Tyler's call. Off is one tap away in Settings.
- **Never lock a phone that cannot unlock.** Availability is
  `getEnrolledLevelAsync() !== NONE`, not `isEnrolledAsync()`, because the
  prompt allows the device passcode as a fallback. A phone with neither
  biometrics nor a passcode is never locked: a privacy feature that shuts the
  owner out of their own receipts is not a privacy feature.
- **The passcode fallback stays enabled** for the same reason. A face that will
  not scan must not be the end of the road.
- **A 60-second grace period.** Photographing a receipt, sharing an export and
  picking an image all leave the app briefly. Demanding a scan on the way back
  from a two-second detour is how a feature gets switched off.
- **Only `background` starts the clock, never `inactive`.** iOS fires `inactive`
  for the Face ID prompt itself; treating that as leaving would mean the prompt
  re-arms the lock that raised it.
- **Nothing of the app renders while locked**, and nothing renders before the
  preference has been read either. The preference comes from AsyncStorage, so a
  frame of the receipt list before the lock appears is a real risk and would
  defeat the whole feature.

- **The app switcher's snapshot is covered**, by an overlay ON TOP of the
  screen rather than instead of it. iOS photographs the screen when the app
  resigns active, and that photograph is visible in the switcher to anyone
  holding the phone, so the content has to be gone before the snapshot. The
  first attempt returned early instead, which unmounted whichever screen was
  showing: a notification banner would have thrown away a scanned receipt, its
  typed corrections and its splits, none of which are in the database until
  Save. `inactive` covers; only a real `background` starts the clock.

The decision rules are in `src/lib/appLock.js`, pure and unit-tested, so "does a
two-second trip to the share sheet demand Face ID again" is a test rather than
something checked by unlocking a phone repeatedly.

### The loop review caught

The first version re-evaluated the lock on every `active` event against a
`backgroundedAt` that no unlock ever cleared. On a cold start that value is
null, which the rules read as "ask" — so the Face ID prompt, whose own dismissal
fires `active`, re-locked the app the instant it succeeded. **A loop with no way
into the app**, on a feature that is on by default, reachable by every user on
their first launch of r31.

The fix is to consume the timestamp: `active` only judges when the app actually
backgrounded, and clears the mark either way. The general shape is worth
keeping: **`inactive` is not `background`, and a state machine driven by
AppState needs to say which transitions it ignores**, not only which it acts on.

A second review pass found three more of the same kind, which is what settled
the design:

- **The cover was a replacement, not an overlay** (above), and would have
  discarded an unsaved scan.
- **The resume decision was asynchronous**, so the receipt list painted for a
  few frames before the lock screen. It is computed synchronously now, from
  values already in hand; the storage re-read refines the next decision rather
  than making this one.
- **A cancelled prompt was never re-asked.** `locked` stays true after a cancel,
  so the next lock event changed no boolean and no prompt could fire again. The
  state carries a `prompts` counter for exactly that.

So the whole gate is a reducer in `appLock.js` now, and every transition is a
fixture: the prompt-dismissal loop, the notification banner, both sides of the
grace period, and the cancelled-then-away case. **Pure rules with an untested
state machine wrapped around them is not a tested feature** — that split is what
let four bugs through in one file. `expo-local-authentication`
now comes off the `check-permissions.js` baseline.

### What this leaves

**`expo-location` is now the only unjustified permission.** Tyler ruled out GPS
mileage (it is a different app), so that permission can never be justified and
the plugin should come out in the next native build. That is the remaining half
of D-066, and it is what build 7 is for.

### The rule

**Ship the feature or drop the permission, and prefer shipping when the feature
is worth having.** The module was already paid for in binary size and in the
privacy label; what it lacked was five hundred lines of JavaScript.

---

## D-080

**A type scale, and brighter greys again** (2026-09-03)

Tyler's second pass on r31, both parts of the same complaint: the small text is
hard to read.

### The greys, once more

|  | original | D-078 | now | on the app background |
|---|---|---|---|---|
| `muted` | `#8a97ab` | `#9aa6b8` | `#b3bcca` | 6.5 -> 7.9 -> 10.1 |
| `muted2` | `#5b6678` | `#78849a` | `#98a3b5` | 3.3 -> 5.1 -> 7.6 |

The thing to watch when brightening secondary text is the hierarchy, and it
holds: `text` 16.5, `muted` 10.1, `muted2` 7.6. Three steps, each visibly
dimmer than the one above.

The light palette moved too, and for a different reason than the dark one: not
to match Tyler's complaint, but because `muted2` there was measurably below AA.
That is the section further down; the two changes are not the same change and
should not be read as one.

### The type scale

The app had **nine** distinct sizes below 15pt: 10, 10.5, 11, 11.5, 12, 12.5,
13, 13.5, 14. Some of those distinctions were real and most were an accident of
whoever wrote that screen. Changing "the small text" meant editing **58 sizes
across 10 files**, which is why the first answer to "it is hard to read" was a
colour change only.

So the palette carries the scale now:

```
xs    10, 10.5, 11    ->  12   overlines, tab labels, badges
sm    11.5, 12        ->  13   notes, hints, list metadata
md    12.5, 13        ->  14   secondary body
body  13.5, 14        ->  15   rows, controls, form labels
```

Headings, amounts and the brand mark keep their own sizes. They were tuned
individually and none of them was ever the complaint.

**Line heights moved with the sizes, and into the scale with them.** A bigger
font in the same box sets tighter than the small one did, which undoes some of
what the change is for. Leaving eight literal `lineHeight`s next to the new
tokens would have re-tightened every paragraph the moment the scale moved
again: the exact regression this entry warns about, one round later and
invisible in the diff that caused it. So `T.lh` sits beside `T.fs`.

**The capture screen has to keep fitting an iPhone 14 without scrolling**
(D-077's neighbour complaint), and a dozen points appeared down the page. The
privacy card gives back six, four in margin and two in padding. That does not
cover it and is not meant to; whether the page still fits is a device question,
not a computable one.

### Why this is worth a decision entry

**Nine sizes below 15pt is not a design, it is a residue.** The knob exists
because this is the second round of the same feedback and there will be a
third: "still a bit small" should be one number, not an afternoon.

`npm run test:type` keeps it that way, in CI: a literal `fontSize` below 17pt
fails, and the scale has to stay ordered. This repo's habit by now (D-061,
D-066, D-076), and for the same reason each time: a convention nobody enforces
is one the next screen forgets.

### Light mode came along for the ride

`muted2` in the light palette measured **3.3:1**, which is WCAG's threshold for
large text and non-text. It renders at 12 and 13 points, where the bar is 4.5,
so it was below AA everywhere it appeared, and `check-contrast.js` was holding
it to the wrong tier. Both are fixed: the light greys darken (`muted` 5.5 ->
7.0, `muted2` 3.3 -> 4.8) and the check holds hint text to AA in both palettes.

That was survivable while light mode was unreachable. r31 made it reachable and
Tyler uses it, so "the complaint was about dark mode" stopped being a reason to
leave it.

### What the ratios were not measuring

The comment claimed the three-tier hierarchy held, and offered three ratios
against the same near-black ground as evidence. Those stay ordered no matter how
close the colours get. The separation between adjacent tiers went 1.96 -> 1.53
-> 1.33 across the two brightenings and nothing was watching it.
`check-contrast.js` measures the steps now, with a floor, so a third
brightening cannot quietly collapse `muted` into `muted2`. It measures the
DIRECTION as well: a symmetric ratio cannot tell a healthy gap from an inverted
hierarchy, and the first version of the check could not have caught the case its
own error message described. Each tier must now stand out from the background
more than the tier below it, which is the same assertion in both palettes.

### Where the check still could not look

Every pairing was token-against-token, so text on a hardcoded ground was never
measured, and there is one: the full-screen photo backdrop is `#000` in both
palettes. Darkening `LIGHT.muted2` took the zoom hint there from 5.96:1 to
**4.07:1**, so a change made for legibility removed some, in the one place
nothing was watching. The hint takes a fixed grey now (10.96:1) and the check
carries the pairing.

**The lesson is the same one as the tier separation, one level up:** a check
that only compares the things it already knows about will keep reporting green
about the things it does not.

---

## D-081

**The appearance switch works. The window override is still unverified**
(2026-09-03)

D-077 shipped with a claim labelled as unverified: that Light and Dark would
work over the air on build 6, whose `Info.plist` still pins
`UIUserInterfaceStyle: Dark`, because `Appearance.setColorScheme()` sets a
window-level `overrideUserInterfaceStyle` and a window override beats the
app-level value.

**Tyler tapped Light and the app turned light.** That confirms the half that
matters most to him and the half that is nearly all of the visible surface.

### It does not confirm the override, and this entry first said it did

`useTheme()` returns `LIGHT` straight from the stored choice; it never consults
`useColorScheme()` on that path, and `apply()` wraps `setColorScheme` in a
try/catch that swallows any failure. So the app turning light happens
identically whether UIKit honoured the window override or ignored it. **The
observation cannot distinguish the two**, and the first version of this entry,
of the `appearance.ts` comment, of STATUS and of the CHANGELOG all read as
though it could.

The only observable for the override is a **system** surface: raise an alert
while Light is selected, and see whether it is light or black. Settings ->
Restore purchases, or Delete all receipts and then Cancel, both do it in one
tap.

### The rule this nearly broke

CLAUDE.md: verify before recommending, and reasoning is not verification. The
labelling worked exactly as intended right up to the point where a real but
*different* observation arrived and got filed against the open question because
it was adjacent to it. **Check that the evidence discriminates**, not only that
evidence exists: "the app turned light" and "the override works" are one
sentence apart and not the same claim.

"System" is still dark until build 7, which is a separate fact about the plist
and unaffected by any of this.
