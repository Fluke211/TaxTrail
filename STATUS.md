# Status

**Last updated:** 2026-08-10 · Update this file at the end of every working session.

| Artifact | Version | State |
|---|---|---|
| PWA (`index.html`) | **v5.5** | **RETIRED** (D-021) — proof of concept. Do not modify: Tyler's unexported receipts live in its browser storage. |
| iOS app (`mobile/`) | **v1.0.0 (build 1) · js r9** | Installed and working on Tyler's iPhone; first real receipt parsed correctly |

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

### EAS quota — actual numbers

Read from the billing page 2026-08-02, so this supersedes the earlier
"~15 builds/month" estimate:

| Meter | Used | Limit |
|---|---|---|
| Total builds | 3 (iOS 2 · Android 1) | **30 / month** |
| Waived builds (failed, not charged) | 6 | **10 / month** |
| Uploaded builds | 0 | 10 / month |
| Monthly active users | 0 | 1,000 |
| Global edge bandwidth | 6.93 KiB | 100 GiB |

Plan: Free, $0.00.

Both iOS builds are this project's (the signing failure and the successful one);
the Android build is from elsewhere in the account. **Failed builds are waived
rather than charged**, which is why the signing failure cost nothing — but the
waiver pool is account-wide and already at 6/10, so failures stop being free
after four more. Query current build records any time with the workflow's
`usage` step.

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
3. Restore from archive — needs `expo-document-picker`, so it batches into the
   production build
4. Store every page of a multi-page receipt (schema migration)
5. Delete both Codespaces (`curly guacamole`, `potential train`) — done with them

Full plan: [`ROADMAP.md`](ROADMAP.md).

---

## Infrastructure

| | |
|---|---|
| EAS workflow | `.github/workflows/eas.yml` — `verify` / `configure` / `build` |
| Build gate | `build` runs preflight always; the build itself needs `confirm_build: BUILD` |
| Repo secret | `EXPO_TOKEN` (set; never printed) |
| Codespace | `.devcontainer/` + `.vscode/tasks.json` — for interactive Apple auth only |
| CI | No test workflow yet. Tests run inside the EAS workflow's `verify` step. |

## Open items and known issues

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

  **Three follow-ups, all Tyler's, none blocking each other:**
  1. **Buy `taxtrail.app`** ($10.98, Namecheap). Also unblocks the support and
     privacy contact address below.
  2. **Rename the Expo project** to `taxtrail` at expo.dev → project settings.
     Then the `slug` in `app.json` can flip. Until then it must stay, or the
     Actions workflow breaks — every Expo domain is 403 from these sessions.
  3. **Rename the GitHub repo** to `taxtrail`. `privacy.html`, `support.html`
     and `FallbackPaywall.tsx`'s `PRIVACY_URL` all change with it.

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
- **Support and privacy pages need a contact email.** `privacy.html` and
  `support.html` carry `CONTACT_EMAIL_PLACEHOLDER`; App Store submission
  requires a working support URL, so this blocks submission.
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
