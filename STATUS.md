# Status

**Last updated:** 2026-08-30 · Update this file at the end of every working session.

| Artifact | Version | State |
|---|---|---|
| PWA (`index.html`) | **v5.5** | **RETIRED** (D-021) — proof of concept. Do not modify: Tyler's unexported receipts live in its browser storage. |
| iOS app (`mobile/`) | **v1.0.0 (build 4) · js r25** | r25 is **live on `production`** (published 2026-08-30, verified at the head of the branch). That fixes the installs that already exist — **not the next one**: build 4 embeds js r22, which crashes, so a fresh install still crashes on first launch until build 5 (D-067). Footer should read `(build 4) · js r25` after two launches |

---

## Where things stand — 2026-08-29

**Pre-launch correctness work is done; what remains needs Tyler or a device.**

Cleared in the overnight session:

| | |
|---|---|
| Export audit (D-046) | Five real defects fixed. The TXF sign convention — the one with the most at stake — turned out to be **already correct**; it is recorded emphatically so nobody "fixes" it later |
| Parser (D-045) | Amounts printed `1. 49` matched nothing at all. Fixed; the synthetic corpus went from 12.6% to 100% on that artifact |
| Gates (D-043) | Free-tier limit and the review prompt are pure functions with tests. The review prompt was genuinely broken |
| Android (D-047) | Audited and **explicitly parked**. OCR was never the blocker — that assumption was wrong |
| CI | Runs unit tests, `tsc`, the synthetic corpus, and a version-stamp check on every PR |
| Store listing | Privacy answers re-verified against the code; both URLs and the contact address confirmed live |

**Shipped as js r17.** Everything above is JS-only and went out over the air;
no native build was needed. The Summary footer should read
`TaxTrail v1.0.0 (build 3) · js r17` once the app has restarted twice.

### Do not submit to the App Store before this is answered

**Build 4 asks for Face ID and Location, and the app has neither feature**
(D-066). Both modules are compiled in with hand-written purpose strings; no file
imports either one, so neither prompt can ever appear. `expo-camera` is a third
unused module, though the camera permission itself is justified by the document
scanner. The App Review notes described an app lock and a mileage log as
shipping features — that text is now removed, and the notes carry an instruction
not to paste it back.

It survived two prior checks because both compared documents with documents. A
new CI check, `npm run test:perms`, compares `app.json` against the code and
baselines the three that already shipped, so a fourth cannot be added quietly.

Two ways out, and it is a product question rather than a cleanup:

- **Drop the plugins in build 5** — smallest permission surface, which is the
  whole argument. Build 5 is already planned, so it costs nothing extra.
- **Ship the features instead** — and note this corrects D-006: because both
  modules are already in build 4, the Face ID app lock and **GPS mileage are
  OTA-shippable today**, with no build and no credit.

### Blocked on Tyler — none of it is code

1. **Confirm the app launches** and the Summary footer reads
   `v1.0.0 (build 4) · js r25`. Everything else waits behind this.
2. **Pick a capture-screen concept** — four mockups delivered
   2026-08-30, rendered in the app's real palette:
   https://claude.ai/code/artifact/62ca2334-2775-4813-afff-ad63dbafebb2
   Recommendation is A with C's recent list. Implementation is one JS change.
3. **Decide the five dark-theme contrast ratios** that sit below the WCAG
   target and have shipped for months — white-on-accent is 3.71:1 on the
   primary button. Baselined rather than changed unilaterally (D-061).
4. **Moving trucks** (U-Haul, Penske, Ryder) — Schedule C line 20a, or stay in
   Travel? Open since 2026-08-29.
5. **Read D-064** — the cloud-AI question is answered (no, and why), and it
   names the one piece of "continuous learning" still missing: a routine for
   getting diagnostics exports into `__tests__/corpus/`. Needs no cloud and no
   decision, only receipts.
6. **Sandbox purchase test** — monthly, annual, lifetime, and Restore. All
   three products read `READY_TO_SUBMIT`.
7. **Screenshots**, six of them. Needs a Mac; see `docs/MAC_SETUP.md`. Slot 2
   is the privacy-label comparison, which is the entire pitch.
8. **Import one export into real tax software.** The whole audit is
   spec-reading; nobody has fed a `.txf` to TurboTax. Still the largest
   remaining unknown in the product.
9. **Real receipts** for the corpus, via Settings → Parser diagnostics (moved
   there, behind seven taps on the version stamp). The corpus is nine receipts
   and it has now found two merchant bugs (D-063, D-065) — it is the highest
   return per unit of Tyler's time of anything on this list.
10. **Small Business Program** acceptance (applied; Apple quotes over a month).

### Build 5 is a submission blocker (D-067)

**Not optional, and not "when it happens" — every fresh install of build 4
crashes on its first launch.** Build 4's embedded bundle is js r22, the bundle
that crashed, and `launchWaitMs` defaults to 0, so a new install runs the
embedded bundle *before* any OTA is applied. r25 only takes effect on the
second launch. Verified against the installed `expo-updates` source and against
build 4's own commit, not inferred.

Consequences today, before anything is submitted:

- **Every new TestFlight tester Tyler adds gets a crash on first launch.** His
  own install works only because it has been running since before the OTA.
- Build 4 cannot be the binary that goes to review.

So build 5 is the one build that has to happen, and everything else waiting on
a build should ride in it. It carries:

- **swipe-to-delete** — written, tested, and held back (D-060, D-062). The
  component was deleted from `main`; recover it from the PR #81 history.
- **Whatever D-066 decides** about `expo-local-authentication`, `expo-location`
  and `expo-camera` — either they come out of `app.json`, or the features that
  justify them go in. Dropping a plugin also means dropping it from `BASELINE`
  in `mobile/scripts/check-permissions.js`.
- Whatever the capture redesign needs, once Tyler picks one.

`buildNumber` must go to **5** in `mobile/app.json` and `APP_BUILD` to **5** in
`mobile/src/lib/version.ts`, in the same commit — Apple already has 4. And add
build 5 to `LIVE_BUILDS` in `mobile/scripts/check-ota-safety.js` **once it has
been observed to launch** (D-062 rule 2), or the OTA check will keep holding
gesture-handler back.

It costs one EAS build credit and needs Tyler's explicit go (CLAUDE.md).

**The free preflight has already been run** (2026-08-30, `step: build` with
`confirm_build` empty, profile `production`, no credit consumed):

- `expo-doctor` and `prebuild` both **pass** — the tree builds
- Apple is reachable, app ID `6797163508`, and already holds builds **2, 3, 4**
  for 1.0.0, so the guard correctly refuses: *"buildNumber 4 is not above what
  Apple already has"*

So build 5 is two numbers and a go. Nothing else stands in the way.

**Do not bump those two numbers ahead of the build.** They are what the footer
prints, and any OTA published from `main` in between would make every build-4
device report "build 5" — the D-039 drift, arrived at from the other side. The
bump belongs in the same commit that dispatches the build.

---

## Build 4 crashed on launch — diagnosed, fixed over the air (D-062)

Tyler installed build 4 on 2026-08-30 and it crashed every launch. **Resolved
without a new build.** He was away and could not reinstall, so everything below
was done over the air.

### What it was

A **JavaScript fatal error** during bundle evaluation. The crash log is
conclusive: `SIGABRT` on `expo.controller.errorRecoveryQueue`, with
`-[NSException raise]` four frames into the app binary. That is
`ErrorRecovery.crash()` in expo-updates, which builds its exception name from
`RCTFatalExceptionName` and reads `RCTJSStackTraceKey`. The `JavaScript` and
`hades` threads are both alive in the report, so Hermes started and evaluated
the bundle before it threw.

`App.tsx` imported `GestureHandlerRootView` at module scope to pre-wire
swipe-to-delete — a feature that had not shipped. That import drags Reanimated's
whole runtime in: build 4's bundle held `NativeReanimated` 87 times with nothing
importing Reanimated. Removing it took the bundle from 1178 modules to **752**.

It was terminal rather than annoying because expo-updates' recovery pipeline
needs somewhere to fall back TO, and a fresh install has only its embedded
bundle.

### The near miss

The same `main` would have destroyed **build 3**, the only working fallback.
Build 3 has neither gesture-handler nor `expo-mail-composer`; `main` statically
imported both, and every update reaches every v1.0.0 binary. One `eas update`
would have left no working install anywhere. It was one dispatch away.

### What was done

| | |
|---|---|
| 09:34 | **r21 rescue published** to `production` — the last bundle proven to run on device. Group `c18b6543-2177-4025-bd72-8c36dabe1fd6` |
| 09:43 | **r23 published** — everything from the overnight work, with gesture-handler removed and `expo-mail-composer` behind a guarded require. Group `9da02f2a-374b-4213-bd97-2161f547287a` |
| 09:50 | **r24 published** — merchant read from the shop's own domain (D-063). Group `390d233c-ce7c-4bd2-8093-e9d1b1da7a9e` |

All three verified against the live channel with `step: channels`: r24 is the head
of `production` at runtimeVersion 1.0.0, so build 4 will fetch it.
| CI | **`npm run test:ota`** now fails any static import of a module a live binary lacks (D-062) |

### If it is STILL broken when you get back

Unlikely — r23's startup path was audited line by line and its only module-scope
native touch is the one the proven r21 bundle already had — but if the app still
crashes, the rollback is one dispatch and needs no build:

```
step: update · update_branch: production · ref: rescue/r21-for-build4
```

That branch is kept at `0b00b937` for exactly this. It republishes r21, which
IS proven to run. Do not delete it until build 5 is installed and working.

Swipe-to-delete is the only feature held back. It needs build 5, and it does not
go in until a binary has been *observed to launch* with it.

### Traps recorded so they are not re-run

- **The airplane-mode test cannot distinguish JS from native.** With no network,
  recovery steps (a) and (b) are unavailable and a fresh install has nothing for
  (c), so any startup fault ends identically. It was read as evidence of a
  native cause and sent the diagnosis the wrong way for an hour.
- **"It built" is not "it shipped."** Building, signing, uploading and clearing
  Apple's processing test nothing about whether the app launches.

### Build 4 attempts

Tyler approved this build explicitly ("BUILD NOW … I pre approve"). It has taken
three submissions, and the first two failed for unrelated reasons:

| When | Build | Code | What it actually was |
|---|---|---|---|
| 23:35 | `c5adc37f` | `UNKNOWN_ERROR` | `Install pods` — `react-native-worklets` 0.8.3 arrived as reanimated's transitive peer against the SDK pin of 0.7.4. Fixed and guarded by `npm run test:pins` (D-054) |
| 23:46 | `167f871b` | `SERVER_ERROR` | "Failed to upload application archive" — Expo's own infrastructure. The worklets fix was in this attempt but never got to run |
| 01:03 | `b8ebc4af` | — | **Succeeded**, 5m34s. Same commit as the second attempt (`fba11d5`), retried because a `SERVER_ERROR` says nothing about the code |

**Submitted at 01:11, and Apple finished processing it.** Verified rather than
assumed: the free build-number preflight queries App Store Connect and now reads
`build numbers already on App Store Connect for 1.0.0: ['2', '3', '4']`.

**Build 4 is installable from TestFlight now**, at
https://appstoreconnect.apple.com/apps/6797163508/testflight/ios

Note that running `step: build` again will now fail the build-number preflight
with "buildNumber 4 is not above what Apple already has". That is the guard
working — the next native build needs `buildNumber` 5 in `mobile/app.json` and
`APP_BUILD` 5 in `mobile/src/lib/version.ts`, in the same commit.

The lesson is written up in `docs/RUNBOOK.md` under "A build errored — find out
why, without expo.dev": the error **code** is what separates "retry it" from
"the diff is broken", and until this session nothing here could read it. The
`usage` step now prints it, free.

August spend so far: **3 completed, 3 errored**, against separate 10/month
pools — see the cost model at the top of the runbook, which was wrong about
this and is now corrected.

---

## Current state

**The development client is installed and working.** Tyler scanned a real
receipt on 2026-08-06 and it parsed correctly — the capture -> OCR -> classify
pipeline is proven end to end on device.

| | |
|---|---|
| Build ID | `c0d5ebc3-8439-4333-aaa0-503feab787d2` |
| Install | https://expo.dev/accounts/tylerthornbrue/projects/taxtrail/builds/c0d5ebc3-8439-4333-aaa0-503feab787d2 |
| Version | **v1.0.0 (build 1) · js r7** |
| Profile | `development` — dev client, ad-hoc internal distribution |
| Provisioned device | iPhone `00008110-000969302ED3A01E` |

Open the link on the registered iPhone to install.

**Resolved:** the first attempt failed on code signing because `expo-notifications`
injects the `aps-environment` entitlement and the provisioning profile predated
that module (D-011). Dropping the module cleared it.

**Answered:** `react-native-document-scanner-plugin` compiles against RN 0.83.
The full Xcode build passed, so VisionKit document capture, camera, Face ID,
print, haptics, and location are all live in this client.

### EAS quota

**Superseded — see the cost model in `docs/RUNBOOK.md`.** The table that stood
here read the free plan as one pool of 30 builds a month. Tyler read the billing
page on 2026-08-29 and it is three separate pools of 10: completed builds,
failed builds, and SDK builds. A failure therefore does not consume a completed
build, which is the difference between "retry costs us a build" and "retry is
nearly free" — and this session spent an evening reasoning from the wrong one.

Measured spend for August, from the `usage` step: **3 completed, 3 errored.**
That step is the only source here that can be checked from a Claude Code
session; the pool limits come from the billing page, which cannot.

## Done

- [x] Repo established as single source of truth
- [x] Project reconstructs and verifies: **10 passed, 0 failed**, `tsc` clean
- [x] EAS project `@tylerthornbrue/receiptsnap` (`d98a6958-bf2b-43c6-8ced-6e3953f0d11f`)
- [x] OTA updates configured — `https://u.expo.dev/d98a6958-...` (must exist before
      building; the URL is baked into the binary)
- [x] Configured project committed to `mobile/` — durable across sessions
- [x] Apple credentials: distribution certificate + ad-hoc provisioning profile,
      Team `5M67JT29GJ`, valid to **31 May 2027**
- [x] iPhone `00008110-000969302ED3A01E` registered and provisioned
- [x] Bundle ID settled: `com.tylerthornbrue.taxtrail`
- [x] Native dependency set chosen and installed
- [x] Permission surface audited and minimized
- [x] CI preflight green: **expo-doctor 19/19**, `expo prebuild` succeeds
- [x] **iOS development client built successfully**

## Next

1. **Scan a batch of real receipts**, then Summary -> Parser diagnostics and
   send the file. That export is now the handoff: it turns a scanning session
   into corpus fixtures, and everything downstream is automatable
2. Grow `mobile/__tests__/corpus/` from those dumps; fix what `npm run
   test:score` flags
3. ~~Restore from archive~~ — **done**, staged for the next build
4. Store every page of a multi-page receipt (schema migration)
5. Delete both Codespaces (`curly guacamole`, `potential train`) — done with them

Full plan: [`ROADMAP.md`](ROADMAP.md).

---

## Production build 2 — the first under the new identity

| | |
|---|---|
| Build ID | `8fdd9bd0-b107-48c4-bcea-c3190f7103a3` |
| Artifact | `https://expo.dev/artifacts/eas/5eF2SUDeiJSDjjmtE8TPiaPctasYdQse2SfZCnXY5NA.ipa` |
| Version | **v1.0.0 (build 2) · js r11** |
| Profile | `production` — **App Store distribution** |
| Bundle | `com.tylerthornbrue.taxtrail` |
| Status | FINISHED |

**The footer on this build reads `build 1`, and that is wrong.** `autoIncrement`
was bumping the build number on the runner without committing it, so the repo
said 1 while the binary was 2 — corrected in D-039, and the footer will read
`build 3` from the next build onward.

**This .ipa cannot be side-loaded.** The `production` profile has no
`distribution: internal`, so it is signed for the App Store. It goes to App
Store Connect / TestFlight via `eas submit`; opening the link on the phone will
not install it, unlike build 1's ad-hoc dev client.

**EAS quota, read from `eas build:list` rather than counted by hand:** 3 builds
on record total — this one, the successful dev client, and the August 2 signing
failure. Well inside 30/month.

**The credential failure cost nothing.** The first `production` attempt failed
inside eas-cli before submitting anything, so EAS has no record of it: it
consumed neither a build nor a waiver. An earlier note in this session guessed
the waiver pool had moved to 7/10; it had not.

## Build 3 — shipped 2026-08-26

Tyler lifted the build-rationing constraint (end of the EAS billing month) and
approved the batch, so everything waiting since build 2 went out in one build.

| | |
|---|---|
| Build ID | `43156c07-a964-4a6c-b8a1-ae38d92586ea` |
| Artifact | `https://expo.dev/artifacts/eas/7Ny0dnDkS01g1r85HVZLBIGZY1BfN9FfVstaWi97XMM.ipa` |
| Version | **v1.0.0 (build 3) · js r12** |
| Profile | `production` — App Store distribution |
| Build time | ~5 minutes (07:39:35 → 07:44:50 UTC) |
| Submission | `d680e7f6-f407-4e79-a458-c46c47b35335` — uploaded successfully |

**What it carries:** the TaxTrail header (D-040), the new icon (D-038),
`taxtrail://capture` (D-024), and restore-from-archive.

**Credentials were reused, not regenerated** — distribution certificate
`500CBE8813BA0F35CB336E6F982E7BE1` and profile `23LJTJK3K7`, both unchanged.
That is the D-011 question answered empirically: `expo-document-picker` adds
iCloud entitlements only under `ios.usesIcloudStorage`, so the profile stayed
valid. Reading the plugin's source beforehand predicted this correctly.

**The build-number preflight earned itself on its first run.** It asked App
Store Connect what existed for version 1.0.0 and got back exactly one number:

```
build numbers already on App Store Connect for 1.0.0: ['2']
OK — build number 3 is free for version 1.0.0.
```

That is direct confirmation of the D-039 diagnosis rather than an inference:
with `autoIncrement` still on, this build would have been numbered **2** — the
number Apple already had — and the upload would have been rejected *after* the
build was spent.

**Non-fatal, worth knowing:** eas-cli logged *"Distribution Certificate is not
validated for non-interactive builds"* and failed to prompt for an Apple Team
ID. It skipped Apple-side *validation* and used the stored credentials; the
build signed and finished. Not an error, and not something to chase.

**Quota, read from `step: usage` rather than counted by hand:** **4 builds on
record, all in 2026-08** — 3 FINISHED (this one, build 2, the August dev
client) and 1 ERRORED (the August 2 signing failure). Against 30/month plus 10
waived, rationing was never close to binding. Worth remembering the next time a
build feels expensive: the constraint has been imagined more often than real.

## The header fix reached build 2 first, over the air

Published to the **`production`** channel before the build-number bump landed,
so the bundle still carries `APP_BUILD = 2` and build 2 reports itself honestly.

| | |
|---|---|
| Update group | `2cb556d9-e656-4109-aae9-eeeadc5066ba` |
| Branch / channel | `production` |
| Runtime version | `1.0.0` |
| From commit | `4de5450` |

On build 2 the other three changes are inert by design: no URL scheme in that
binary, and the Restore card hides itself when `expo-document-picker` is absent.

Getting there required fixing `step: update`, which hardcoded
`--branch development` and so could never reach TestFlight at all — the failure
the runbook's "which build am I updating?" section warns about, wired into the
tooling.

## TestFlight submission — done 2026-08-21

| | |
|---|---|
| Submission | `833b2322-d1e7-4395-9a72-d9ebf0c4e614` |
| Build | `8fdd9bd0…` · v1.0.0 build 2 |
| ASC App ID | `6797163508` |
| TestFlight | https://appstoreconnect.apple.com/apps/6797163508/testflight/ios |

Apple processes the binary for 5–10 minutes and emails when it finishes.

**Noted, non-fatal:** the run logged *"App Store Connect credentials are
incomplete, skipping TestFlight setup"* and still uploaded successfully. That
step only auto-configures internal testing groups, so **adding an internal
tester may be a manual step** in App Store Connect the first time.

**Getting here took three eas.json corrections**, each from reading source
rather than the error text, because eas-cli's guidance was incomplete each
time:

1. *"Set `ascAppId` in the submit profile"* — true, but not where
2. `"submit.production.ascAppId" is not allowed` — it belongs under `ios`
3. *"App Store Connect API Keys cannot be set up in --non-interactive mode"* —
   **the submit flow does not read the build's ASC env vars.** It resolves the
   key from the submit profile, so the profile now references the same variables
   through eas-json's `env-string` interpolation

That third point is the one worth remembering: build and submit resolve Apple
credentials by different routes, and D-034 only established the build half.

None of the three failures cost anything — they errored inside eas-cli before
reaching EAS's services.

## App Store Small Business Program

Applied 2026-08-21. Apple emails a confirmation that enrollment is **under
review**; approval itself is a separate, later notification, and Apple's own
wording is that review takes **over a month**. Status shows in App Store Connect
under **Business**.

**The rate change is not retroactive to the approval date.** Proceeds adjust
**15 days after the end of the fiscal month in which enrolment is approved** —
approved on 10 February means adjusted from 14 March. Nothing has sold, so
waiting costs nothing, but do not gate launch on it.

## Infrastructure

| | |
|---|---|
| EAS workflow | `.github/workflows/eas.yml` — `verify` / `configure` / `build` |
| Build gate | `build` runs preflight always; the build itself needs `confirm_build: BUILD` |
| Repo secret | `EXPO_TOKEN` (set; never printed) |
| Codespace | `.devcontainer/` + `.vscode/tasks.json` — for interactive Apple auth only |
| CI | No test workflow yet. Tests run inside the EAS workflow's `verify` step. |

## Open items and known issues

- **RESOLVED (2026-08-29) — all three products are fetchable.** Both
  subscriptions were stuck in `MISSING_METADATA` while the lifetime unlock was
  fine, so the paywall would have offered one product of three.

  The cause was one empty field, one level up: subscription group `22281099`
  had **no localization**, and a group without a display name holds every
  subscription under it in `MISSING_METADATA`. Both subscriptions were
  themselves complete the whole time — localizations, prices, review screenshot
  and territory availability all present — which is why three passes of
  per-product checks came back clean before the probe looked at the parent.

  Tyler set the group display name to **TaxTrail Pro**, and `asc-iap` now
  reports:

  ```
  group name [en-US] = 'TaxTrail Pro'
  ok receiptsnap_pro_annual   state=READY_TO_SUBMIT
  ok receiptsnap_pro_monthly  state=READY_TO_SUBMIT
  ok receiptsnap_pro_lifetime state=READY_TO_SUBMIT
  ```

  **The lesson worth keeping:** check the object that owns the object. Every
  per-product field was populated, so a check that only looked at products
  could never have found this. `step: asc-iap` now looks at both levels.

  The group's *reference name* still reads "ReceiptSnap Pro" — internal only,
  never shown to users, and left alone deliberately.

- **RESOLVED — the app is now TaxTrail (D-026).** App Store Connect record is
  **`TaxTrail: Receipt Scanner`**, subtitle *"Categorization for Schedule C"*.
  USPTO returns **zero hits** for TAXTRAIL; Google Play is clear; the only
  same-root app is [MyTaxTrail](https://apps.apple.com/us/app/mytaxtrail/id6756753200)
  (0 ratings, manual entry, no OCR). Diligence: `docs/NAMING_2026-08.md` §6.
  Bundle identifier is now `com.tylerthornbrue.taxtrail`.

  **Six identifiers still say ReceiptSnap on purpose** — reasons in D-026:
  the on-device SQLite file `receiptsnap.db` (renaming orphans Tyler's
  receipts), the three App Store Connect product IDs (permanent; recreating
  discards the annual trial and price schedules), the Expo `slug`, the two
  guardrailed files, the historical docs, and the GitHub repo name.

  **Follow-ups:** Expo project renamed to TaxTrail and the GitHub repo renamed
  to `TaxTrail` (both done 2026-08-10). The Pages URLs are now
  `https://fluke211.github.io/TaxTrail/...`. **The Expo `slug` stays
  `receiptsnap` permanently (D-028)** — renaming the project changed its display
  name only, and two controlled `usage` runs proved the flip breaks
  `eas build:list`. It is developer-facing plumbing and nothing else. The old
  `receipt-snap` Pages path returns 404, which had silently broken the paywall's
  privacy link — fixed in js r10. Remaining: **buy `taxtrail.app`** (D-027).

- **No standalone CI on pull requests.** Tests only run when the EAS workflow is
  dispatched manually. A push/PR-triggered test workflow would catch regressions
  automatically.
- **`setup-receiptsnap-mobile.sh` emits the old bundle ID** (`com.vaultvision.*`)
  and produces a project with no EAS `projectId`. Left byte-unchanged per the
  guardrail; `mobile/` is authoritative. The fallback paths warn about this.
- **Android was never audited.** The duplicated `RECORD_AUDIO` permission was
  removed, but the whole Android surface needs a pass before Android is taken
  seriously.
- **RevenueCat: dashboard side IN PROGRESS (2026-08-02, driven from Atlas via
  the RevenueCat MCP).** Done: project **`proj63a7fa32`** created; restore
  behavior set to "Transfer if there are no active subscriptions" (D-012);
  App Store Connect app record created as **"ReceiptSnap: Expense Organizer"**
  (D-013), bundle `com.tylerthornbrue.taxtrail`. RC iOS app
  **`appc76b61980d`**; products registered in RC —
  `receiptsnap_pro_monthly`=`prod1b93a74c4b`,
  `receiptsnap_pro_annual`=`prode8994cbc24`,
  `receiptsnap_pro_lifetime`=`prodce9319f158` (**non-consumable**, verified
  `type: non_consumable`); entitlement `pro`=`entl1fcff973a4` with ALL THREE
  attached (incl. the lifetime); offering `default`=`ofrng6092a617e4` with
  standard packages `$rc_monthly`/`$rc_annual`/`$rc_lifetime` (`$rc_lifetime`
  accepted as-is). **Public SDK key:
  `appl_lkFpBkvUDvsOfXJAZJluSWduCIv` — WIRED into `src/lib/config.ts`
  (js r2, this PR).** Purchases configure at app start; free tier is
  unchanged (every failure path resolves to free mode), and until the Paid
  Applications agreement is signed, product fetches degrade to "Store
  unavailable" — safe by design. **ASC push COMPLETE (2026-08-02):** Apple keys
  uploaded (same team-level keys as VaultVision, team `5M67JT29GJ`); all
  three products created in App Store Connect — group **ReceiptSnap Pro**
  holds the two subscriptions, `ONE_WEEK` free trial verified on annual only
  (start 2026-08-02), lifetime created outside the group, US-only
  availability, $6.99/$39.99/$99.99 with full territory price schedules
  (Apple equalization from US base for the subscriptions). ASC status
  `MISSING_METADATA` = expected until submission time (review screenshot per
  product, privacy-policy URL, and the two first-submission-with-binary
  requirements — Apple counts "first subscription" and "first non-consumable"
  SEPARATELY). **No webhook — no backend exists, by design** (D-012); SDK
  entitlement checks are client-side.
- **Dev clients pin their launched update (D-018).** A successful `eas update`
  does NOT mean the device is running it — the dev client does not poll the
  channel. Confirm by asking for the version stamp. From js r6, Summary has a
  "Tap to check for updates" button; before that it needs dev menu -> Go home.
- **App Privacy label RESOLVED (D-022).** Not "Data Not Collected" — RevenueCat
  requires disclosing Purchase History. But it is one row, **not linked to
  identity and not used for tracking**, because the app uses anonymous app user
  IDs, no customer attributes and no ad SDKs. Label reads **"Data Not Linked to
  You — Purchases"**. Exact questionnaire answers in
  `docs/APP_STORE_LISTING.md`. The GTM hero comparison needs rewording away from
  "Data Not Collected"; the contrast against competitors survives.
- **`taxtrail.app` is owned** (Cloudflare Registrar, $14.20, 2026-08-10),
  superseding the borrowed address in D-027. The public site is written and
  lives in `site/` — landing page, privacy policy, support page, all on
  `support@taxtrail.app` (D-030).

  **Cloudflare is now driven from CI** — `.github/workflows/cloudflare.yml`,
  steps `status` / `email` / `pages` / `verify` (D-031). There is no MCP server
  for Cloudflare DNS, Email Routing or Pages; the API is reachable, so it runs on
  the EAS pattern with a scoped token in repository secrets.

  **`taxtrail.app` is LIVE (D-033).** Cloudflare Pages serves `site/` at the
  apex; landing page, privacy policy and support page all verified returning 200
  five times consecutively. Email routing is enabled with a catch-all to
  `tylerthornbrue@gmail.com`, which was already a verified destination, so no
  verification email was needed. DNS: 3 MX, SPF, DKIM, and a proxied CNAME at
  the apex to `taxtrail-arf.pages.dev`.

  The app's `PRIVACY_URL` and both App Store URLs now point at `taxtrail.app`
  (js r11). **This was the last submission blocker on the support/privacy side.**

  Cloudflare's Email Address Obfuscation rewrites the `mailto:` links into
  `/cdn-cgi/l/email-protection`. Deliberate and left on — it is anti-harvesting
  for a public support address, and real browsers render it normally.

- **Bundle identifier chain — COMPLETE (2026-08-21).**

  | # | Link | State |
  |---|---|---|
  | 1 | Apple Developer App ID `com.tylerthornbrue.taxtrail` | **done** — created via the ASC REST API, no build spent |
  | 2 | App Store Connect record's bundle ID | **done** — Tyler switched the dropdown; confirmed from Apple's API as `TaxTrail: Receipt Scanner -> com.tylerthornbrue.taxtrail` |
  | 3 | Distribution certificate + provisioning profile | pending — created **during** a build, so it needs one build slot and Tyler's go |
  | 4 | RevenueCat iOS app bundle ID | **done and verified 2026-08-20** — `app_store` app `appc76b61980d` "TaxTrail iOS", `bundle_id=com.tylerthornbrue.taxtrail`, read back through the v2 API |

  **The app id is unchanged (`appc76b61980d`), which settles the risk raised
  before the edit:** Tyler edited the existing RevenueCat app rather than
  creating a new one, so the three products, the `pro` entitlement and the
  public SDK key in `src/lib/config.ts` all remain valid. A new app would have
  carried none of them and would have made the shipped `appl_` key wrong.

  Cosmetic only: the RevenueCat **project** is still named "ReceiptSnap". It is
  a dashboard label, not an identifier — nothing depends on it.

  **The failed build cost nothing** — `eas build:list` still shows two builds
  total, both from 2026-08-02. It failed client-side during credential setup and
  never reached the build queue, so neither the monthly quota nor the waiver pool
  moved.

  **An App Store Connect API key is wired up and verified (D-034).** Secrets
  `ASC_API_KEY_P8` / `ASC_KEY_ID` / `ASC_ISSUER_ID`; `asc-check` returned 200 on
  apps, bundleIds, certificates and profiles, so the key has Admin scope.
  **The Codespace is no longer needed for the App ID or provisioning profiles** —
  but D-034 over-reached: the **distribution certificate** still needs one
  interactive session (D-037). After that, CI builds are non-interactive.

  Two free workflow steps talk to Apple directly: `asc-check` (read-only) and
  `asc-bundle-id` (idempotent create). Neither costs a build.

  **expo.dev will keep showing the old bundle identifier** until the next build —
  server-side state from the last one, not a missed reference.

- **Do not put a custom domain on this repo's GitHub Pages (D-029).** It would
  redirect `fluke211.github.io/TaxTrail/` to the new origin, and the retired
  PWA's `localStorage` — holding Tyler's unexported receipts — is scoped to
  `https://fluke211.github.io`. Verified still serving 200 at the renamed path,
  so nothing is lost yet.

- **Category inference is weak without a merchant hint.** `npm run test:score`
  flags both Costco fixtures as `uncategorized, low-confidence` — totals and
  sales tax are correct, but the category falls through unless merchant memory
  supplies a name. Worth attacking once the corpus is bigger than three.
- **Apple credentials expire 31 May 2027** and renewal is an interactive trip.
- **Two Codespaces exist** (`curly guacamole`, `potential train`). Delete both
  once credential work is finished — idle ones consume the storage allowance.

## Session log

**2026-08-10** — **Renamed to TaxTrail** (D-026): 84 strings across 21 files,
bundle identifier now `com.tylerthornbrue.taxtrail`, js r9. Six identifiers held
back deliberately, including the SQLite filename and the App Store Connect
product IDs. Tests 10/10, `tsc --noEmit` clean, score harness unchanged at 3/5
clean. Name settled as **TaxTrail: Receipt Scanner** after Tyler ran
the App Store Connect check, USPTO (zero hits) and the domain check; full due diligence in `docs/NAMING_2026-08.md` §6.
Corrected an error in that document: domain availability was first judged by DNS
lookup, which cannot distinguish an undelegated registered domain from a free
one — re-verified by RDAP, four `.com` candidates were in fact taken. Earlier the
same day, answered four open questions, none of which changed the code.
**Barcode scanning is already compiled in**: `expo-camera@55.0.21` (in build 1)
exposes `onBarcodeScanned` and `scanFromURLAsync` across `upc_a`, `upc_e`,
`ean13`, `ean8`, `code128`, `code39`, `itf14`, `pdf417`, `qr`, `aztec`,
`datamatrix` — so the barcode-to-receipt lookup for personal returns ships over
the air with **no build**. Name shortlist written and recommended
(`docs/NAMING_2026-08.md`). Control Center / launcher shortcuts researched and
decided (D-024): ship a URL scheme with the production build, defer the native
`ControlWidget`. Cross-surface rule placement decided (D-025) with a paste-ready
block in `docs/CROSS_SURFACE_RULES.md`.

**2026-08-06** — js r5: category picker rebuilt as a modal after Tyler hit it
overflowing over the Save button (D-017); the same bug existed in two other
call sites. Second real receipt (camera, not library) also parsed correctly.
Earlier the same day, js r3 then r4 shipped over the air. r3: VisionKit document
scanning, multi-page capture, receipt archive export (D-016), decision-ID
collision resolved. Tyler installed it and scanned a real receipt successfully.
r4: pinch-zoom on receipt photos (reviewing a parse means reading line items),
parser diagnostics export, and a classifier scoring harness with a seeded
corpus. Canon rule added to CLAUDE.md after this file was found stale.

**2026-08-02** — Established the Actions-based EAS pipeline; created and
configured the EAS project; committed the project to `mobile/`; set up Apple
credentials interactively; changed the bundle identifier; added native
dependencies and audited the resulting permissions; wrote this documentation
set. First build failed on the push entitlement; dropped `expo-notifications`
and the second build succeeded. **Dev client v1.0.0 (build 1) is installable.**
Separately (Atlas RevenueCat session): RevenueCat project `proj63a7fa32`
created, restore behavior set, ASC app record created as "TaxTrail: Expense
Organizer" — plain "TaxTrail" and several permutations were taken (D-013) —
and the full dashboard + App Store Connect configuration executed: products
(incl. the non-consumable lifetime), entitlement `pro`, offering, public SDK
key, and the ASC push with the `ONE_WEEK` annual trial. See the RevenueCat
open item above and D-012.

**2026-08-01** — Repo seeded: installer script, devcontainer, task runner, GTM
strategy, `CLAUDE.md` handoff.
