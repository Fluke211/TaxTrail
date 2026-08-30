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
not. The question is whether receiving any of it costs the **Data Not Collected**
label, which is the entire product pitch.

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
