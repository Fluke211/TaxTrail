# Runbook

How to perform the recurring operations. Each procedure states what it costs,
because the expensive ones are worth avoiding.

---

## Cost model — read this first

| Action | Cost | Needs Tyler? |
|---|---|---|
| JS/TS change → OTA update | Free | No |
| `verify` CI run | Free | No |
| `configure` CI run | Free | No |
| Preflight (`build` step, no confirmation) | Free | No |
| Publish an EAS Update | Free | No |
| **EAS build** | **1 of 30/month** | **Yes — explicit approval** |
| Apple credential work | Free, but a Codespace trip | Yes — types Apple password + 2FA |

**JS-only changes never need a build.** Anything in `src/`, including the
classifier, screens, and exporters, ships over the air.

Quota (free plan). The "30 builds/month" figure that was here is **not one
pool**. Tyler read the dashboard on 2026-08-29 and it decomposes as:

| Pool | Per month | Spent in 2026-08 |
|---|---|---|
| Completed builds | 10 | 3 |
| Failed builds | 10 | 3 |
| SDK builds | 10 | 0 |

The consequence is the useful part: **a failed build does not cost a completed
one.** They draw on separate allowances, so retrying a build that errored is
much cheaper than the single-pool reading suggested — which matters, because
the honest response to an ambiguous failure is usually to retry it once.

The month totals above are what the `usage` step measured, and it is the only
number here this session can verify; the per-pool limits come from the billing
page, which is unreachable from Claude Code. Re-read them rather than trusting
this table if a build is ever refused.

---

## Reset the branch after every merge — do this first

PRs are **squash**-merged, so the feature branch's commits never become
ancestors of `main`. Keep working on the old branch and the next PR conflicts
with your own already-merged work. This has bitten four times.

Before starting any change:

```bash
git status --short                                        # must be empty first
git fetch origin main && git checkout -B <branch> origin/main
```

**`git status` first, every time.** `checkout -B` silently discards uncommitted
work in the tree. Run it mid-change and the edits are gone with no warning — see
D-040, where a whole PR's worth of app changes vanished this way and only the
canon edits, re-applied afterwards, made it into the commit. The commit message
still described the lost work, so nothing downstream caught it.

If you only notice after committing, replay just the unmerged commits — do not
resolve a conflict against yourself:

```bash
git rebase --onto origin/main <last-already-merged-commit> HEAD
git checkout -B <branch>
git push --force-with-lease
```

---

## Ship a JS change (the common case)

0. **Reset the branch from `main`** — see above.
1. Edit under `mobile/src/`.
2. Bump `JS_REVISION` in `mobile/src/lib/version.ts`.
3. Run the tests: `cd mobile && npm run test:unit && npx tsc --noEmit`.
4. Commit, push, open a PR, merge to `main`.
5. Publish the update — dispatch the workflow with `step: update` and an
   `update_message`. It runs:
   ```bash
   eas update --branch development --message "..." --non-interactive
   ```
6. Tell Tyler the new `js r<N>` so he can confirm what he's running from the
   Summary footer.

The channel is `development` for the dev client. Production builds use the
`production` channel — see `mobile/eas.json`.

---

## Run a CI step

**A `workflow_dispatch` workflow can only be dispatched once it exists on the
default branch.** Triggering one that lives only on a feature branch returns a
bare `404`, which reads like a missing file rather than a policy. Merge first,
then dispatch — the `ref` input still selects which branch's copy runs.



All EAS CLI work runs in `.github/workflows/eas.yml`. Dispatch via the GitHub
API (an agent can do this directly) or from the Actions tab.

| Input `step` | What it does |
|---|---|
| `verify` | Reconstructs or installs the project, runs unit tests + `tsc --noEmit` |
| `configure` | `eas init` + `eas update:configure`, commits the result to an `eas-config` branch |
| `build` | `expo-doctor` + `expo prebuild` preflight, then the iOS build |
| `usage` | `eas build:list`, summarised by month and status |
| `update` | Publishes the JS bundle to the `development` channel |

**The build is double-gated.** The `build` step runs preflight unconditionally
but refuses the actual build unless the `confirm_build` input is exactly
`BUILD`. So:

- **Preflight only (free):** dispatch `step: build`, leave `confirm_build` empty.
  The run ends red with `Build not authorized` — that is success.
- **Real build:** dispatch `step: build` with `confirm_build: BUILD`. Only after
  explicit approval from Tyler.

Always preflight before building. It catches config-plugin and schema errors at
zero cost. It cannot catch Swift compile errors — only a real build does.

**And nothing in this pipeline tests whether the app launches.** Build 4 built,
signed, uploaded and cleared Apple's processing, then crashed on every launch
(D-062). Until a device has run it, say "built", not "shipped".

---

## Add a native dependency ONLY with the feature that uses it

The rule that build 4 cost us (D-062). Read it before adding a module.

A native build is the only moment native modules can be added, which makes it
tempting to add whatever might be wanted later while the build is being spent
anyway. **Do not.** An unused module is not free — it is untested weight in the
startup path. `GestureHandlerRootView` was imported for a feature that had not
shipped, that import drags Reanimated's entire runtime in, and the app died on
launch with no way back.

Three rules:

1. **A module goes in the build that ships the feature using it.** Spare
   capacity in a build is not a reason.
2. **A binary is not shipped until it has been observed to launch.**
3. **A module not present in EVERY live binary must never be statically
   imported.** `runtimeVersion` policy is `appVersion`, so one `eas update`
   reaches every v1.0.0 build — including older ones compiled without it. Reach
   it through a guarded require inside a function and hide the control when it
   is absent (`isRestoreAvailable()` in `exportShare.ts`).

Rule 3 is enforced: `npm run test:ota` holds a committed record of what each
live binary was compiled with and fails CI on any static import it cannot
resolve. **When a new build ships, add it to `LIVE_BUILDS` in
`mobile/scripts/check-ota-safety.js`.** Never weaken the rule to get a publish
through.

---

## An OTA can rescue a binary that crashes on launch

expo-updates runs a recovery pipeline on a startup crash: fetch a newer update →
launch it → else fall back to an older working update → else crash. So a JS
fatal error is recoverable **without a new build**, which matters enormously
when the person who would have to reinstall is asleep.

Publish a bundle known to run, from the last good commit:

```
step: update · update_branch: production · ref: <the good commit's branch>
```

`workflow_dispatch` needs a branch or tag, not a SHA — push a throwaway ref
first (`git push origin <sha>:refs/heads/rescue/<name>`).

It applies on the **second** launch: expo-updates runs the cached bundle and
downloads in the background, so it is launch, force-quit, launch again.

Two things to know:

- **A fresh install has no fallback.** Its embedded bundle is the only one it
  has ever had, so steps (b) and (c) have nothing to offer and the crash is
  terminal until a newer update exists to fetch. Publishing one IS the fix.
- **Airplane mode cannot tell you whether the fault is JS or native.** With no
  network the recovery pipeline collapses to "crash" either way. This was
  misread once and cost an hour (D-062).

---

## Add a native dependency — the procedure

Read the section above first: **only add what the feature needs now** (D-062).

1. Add to `mobile/package.json` with an SDK-55-compatible version
   (`npm view <pkg> versions --json` and look for `55.x`).
2. Add any config plugin entry to `mobile/app.json` with **explicit permission
   strings** that state on-device processing.
3. **Inspect the generated `Info.plist`** — plugins add permissions silently:
   ```bash
   cd mobile && npm install && npx expo prebuild --platform ios --no-install
   python3 -c "import plistlib,glob;d=plistlib.load(open(glob.glob('ios/*/Info.plist')[0],'rb'));[print(k) for k in sorted(d) if 'UsageDescription' in k]"
   rm -rf ios
   ```
   Disable anything unnecessary by passing `false` to the relevant plugin option
   (see `expo-image-picker`'s `microphonePermission`, `expo-location`'s
   `locationAlwaysPermission`).
   **A prebuild `Info.plist` is the build's INPUT, not its output.** Config
   plugins can add a shell build phase that edits the plist during the build —
   `expo-dev-launcher` strips its local-network key from every non-Debug build
   that way (D-044). A key visible here may not ship; check the plugin's build
   phases before concluding one does.
4. **Check the entitlements file too**, not just `Info.plist`. An added
   entitlement invalidates the existing provisioning profile and means redoing
   credentials (D-011):
   ```bash
   cat ios/*/*.entitlements     # `<dict/>` means nothing was added
   ```
   Some plugins add entitlements only under a condition — `expo-document-picker`
   adds iCloud ones **only** if `ios.usesIcloudStorage` is set, which this app
   does not set. Read the plugin's own source (`node_modules/<pkg>/plugin/build`)
   rather than assuming either way.
5. Verify New Architecture compatibility for non-Expo packages — look for
   `codegenConfig` in the package's `package.json`. RN 0.83 has no legacy
   bridge fallback.
6. **If the new module is reachable from JS that ships over the air, guard it.**
   An `eas update` can land on a binary compiled before the module existed;
   `require` it in a `try`/`catch` and hide the control rather than offering one
   that throws (see `isRestoreAvailable` in `exportShare.ts`).
7. **Run `npm run test:pins`.** npm resolves transitive peers on its own, and
   one arriving outside the SDK's pinned range kills the build in `Install
   pods`. This is exactly how build 4 died: three modules were hand-checked
   against `bundledNativeModules.json` and a fourth, `react-native-worklets`,
   came in as reanimated's peer at 0.8.3 against a pin of 0.7.4 (D-054). CI
   runs this too, so it is a pre-push convenience rather than the guard itself.
8. Bump the build number — see the next section.
9. Preflight in CI, then request approval for the build.

---

## A build errored — find out why, without expo.dev

An ERRORED build writes its reason to expo.dev, which these sessions cannot
reach. `build:list` carries it too, so the `usage` step prints it:

```
step: usage        # free, ~60s, no approval needed
```

Read the **error code** first, because it says whose fault it was:

| Code | Whose fault | What to do |
|---|---|---|
| `SERVER_ERROR` | Expo's infrastructure | Retry as-is. Nothing in the diff is implicated. |
| `UNKNOWN_ERROR` | The worker, usually `Install pods` | A native dependency conflict. Start with `npm run test:pins`. |
| `XCODE_BUILD_ERROR` | The worker, at signing or compile | The message names the target and the missing capability. |

Build 4 hit two of these eleven minutes apart and they looked identical from
here — both just "the build failed". The first was `UNKNOWN_ERROR … See logs of
the Install pods build phase` (the worklets pin), the second `SERVER_ERROR —
Failed to upload application archive`, which was Expo dropping the upload and
had nothing to do with the fix that had just been pushed. Retrying the first
would have wasted an attempt; not retrying the second would have wasted an
evening.

A `SERVER_ERROR` still records an ERRORED build against the failed-build pool,
so it is not free — it is just not a signal about the code.

---

## Bump the build number — same commit that dispatches the build

`autoIncrement` is **off** (D-039). The build number lives in git, so it does
not move on its own, and both places must move together:

| File | Field | What it drives |
|---|---|---|
| `mobile/app.json` | `ios.buildNumber` | the `CFBundleVersion` Apple sees |
| `mobile/src/lib/version.ts` | `APP_BUILD` | the version stamp in the Summary footer |

**Do this in the same commit that dispatches the build, not before.**
`version.ts` ships over the air, so bumping `APP_BUILD` early would make a
phone still running the *previous* binary display the *next* build's number —
which is the exact drift D-039 exists to stop.

Forgetting is not silent: the `Build number preflight` step asks App Store
Connect which numbers already exist for this marketing version and fails the run
**before** `eas build` starts, so it costs no quota. Its error names the number
to set.

---

## Preflighting a build costs nothing, and answers most of the question

`step: build` with **`confirm_build` left empty** runs everything a build needs
and then refuses to start one — the step's first line is
`if [ "$CONFIRM_BUILD" != "BUILD" ]; then exit 1`. The run ends red. That red is
the guard working, not a failure, and **no credit is consumed** (D-015).

What it tells you, for free:

- `expo-doctor` and `prebuild` — whether the tree actually builds
- the Apple API — that the key works and which build numbers App Store Connect
  already holds

Run it before asking Tyler for a build, every time. The 2026-08-30 preflight is
the model: doctor and prebuild passed, and the build-number step refused with
*"buildNumber 4 is not above what Apple already has for 1.0.0 (highest: 4)"* —
which turned "can we build?" into a two-line change before a credit was at risk.

**Bump `buildNumber` and `APP_BUILD` in the same commit that dispatches the
build, never earlier.** Those two numbers are what the footer prints, so an OTA
published from `main` in between would have every device on the *old* binary
reporting the new build number — the D-039 drift, from the other direction.

---

## "Apple accepted the upload" is not "the build is installable"

`eas submit` finishing green means Apple took the bytes. Processing happens
afterwards and can still fail — invalid entitlements, a missing icon, a bad
`Info.plist` — and when it does, the build simply never appears in TestFlight.
The only signal is an email.

```bash
# GitHub Actions -> EAS -> Run workflow -> step: asc-builds
```

Read-only and free. It prints every build's `processingState` and whether it is
installable, and **fails the run if any build is FAILED or INVALID**. First real
run, 2026-08-31, immediately after build 5 was submitted:

```
build 5    VALID    installable
build 4    VALID    installable
```

`VALID` is the answer you want: Apple finished processing and the build can be
installed. `PROCESSING` means wait. `FAILED`/`INVALID` means **cut a new build**
— a resubmit of the same binary cannot fix it.

One gotcha: the `uploadedDate` Apple returns is not UTC. Build 5 was submitted
at 03:12 UTC and reads `2026-08-30T20:12:57`. Compare builds to each other, not
to your own clock.

This exists because the project had no way to ask. Build 4's crash was found by
Tyler, not by tooling (D-062), and a processing failure would have reached him
the same way.

---

## A permission needs a feature behind it

A config plugin writes a purpose string into the shipped `Info.plist` whether or
not any code ever asks for it. Everything downstream still passes: prebuild
succeeds, the plist matches the config, the App Review notes match the plist.
The permission is simply never used, and nothing notices.

Build 4 shipped three that way — `expo-local-authentication`, `expo-location`
and `expo-camera` (D-066). It got past D-007's plist inspection and D-044's
notes review because **both compared documents with documents.** Neither looked
at the code, which was the only place the answer was.

```bash
npm run test:perms    # also runs in CI on every PR
```

`scripts/check-permissions.js` reads the plugin list out of `app.json`, greps
the app's own sources for each module (a guarded `require` counts — that is a
real optional feature), and fails on any that nothing imports. The three that
already shipped are in `BASELINE`, so it ratchets: a fourth fails, and these
three can only get fewer.

**Removing a plugin does not remove the permission from a binary already in
someone's hands.** It takes a native build. So when D-066 is settled, whatever
comes out of `app.json` also comes out of `BASELINE`, and the permission itself
leaves at build 5.

The cheapest version of this check is one line, and it is worth running by hand
any time a claim is made about what the app does:

```bash
grep -rn "expo-location" mobile/src mobile/App.tsx    # nothing? then it has no feature
```

---

## An OTA can only use native modules the BINARY already has

`eas update` ships JavaScript. It cannot add a native module. So the moment
`main` imports one that the installed binary lacks, publishing breaks the app
on launch — and because `runtimeVersion` is `1.0.0` for every build so far,
**an update meant for the new build reaches the old one too.**

**This is now checked mechanically. Do not rely on remembering it:**

```bash
npm run test:ota      # also runs in CI on every PR
```

`scripts/check-ota-safety.js` holds a committed record of the native modules
each **live** binary was compiled with, scans every static import the bundle can
reach, and fails naming both the module and the files importing it.

The rule was already written here, in this section, before build 4 — as a manual
`git diff | grep` to run before publishing. Nobody ran it, `main` ended up
statically importing two modules build 3 lacks, and one dispatch would have
bricked the only working install (D-062). A procedure that depends on someone
remembering it is not a guard. That is the whole reason this is a script now.

When something does fail the check: either reach the module through a guarded
require and hide the control when it is absent (`isRestoreAvailable()` in
`exportShare.ts`), or hold the feature until every live binary carries it.
**Add each newly shipped build to `LIVE_BUILDS` in that script** — that is the
one maintenance step it needs.

The alternative is to give each build its own `runtimeVersion`, which stops
updates crossing between them — at the cost that an old build then receives no
updates at all. Not done yet; worth considering before the App Store release,
when real users will be on several builds at once.

## Which build am I updating? Read this before every `eas update`

**The channel is baked into the binary at build time; how the app got onto the
phone is a separate axis.** Publishing to the wrong channel is the single most
common way an OTA update appears to do nothing.

| Build | Bundle | Channel | Reaches it with |
|---|---|---|---|
| Build 1 — ad-hoc dev client | `com.tylerthornbrue.receiptsnap` | `development` | `eas update --branch development` |
| Build 2 — App Store / TestFlight | `com.tylerthornbrue.taxtrail` | `production` | `eas update --branch production` |

**Build 1 is stale and drifting.** It carries the *old* bundle identifier, so
RevenueCat — now configured for the new one — will not validate purchases
against it, and it has no `expo-document-picker`, so the Restore card added in
js r12 stays hidden there (`isRestoreAvailable()`). It is still fine for parser
and UI work; it is not a place to test purchases or restore.

**Default to TestFlight + `--branch production`.** It is the actual shipping
artifact, purchases work against the matching bundle identifier, and JS changes
still land in seconds without a build or a review. TestFlight builds expire
after 90 days.

**Workflow inputs never reach the shell directly.** Every one is passed through
`env:` and read as `"$VAR"`. A `${{ inputs.x }}` written inline is substituted
into the script *before* bash parses it, so an update message containing
`$1000` became a shell expansion and killed a publish under `set -u`. The same
hole would let arbitrary text run commands in a job holding `EXPO_TOKEN` and an
Apple signing key, so this is a rule rather than a preference.

**Publish it with `step: update` and the `update_branch` input** (defaults to
`production`). That input exists because the step used to hardcode
`--branch development` and therefore *could not* reach TestFlight at all — the
exact failure this section warns about, wired into the tooling. Before
publishing, the step now prints which binary the channel reaches and the
`version.ts` stamp the bundle carries, so the run log records what went where.

**`APP_BUILD` must match the binary you are publishing to**, not the next one.
It ships inside the JS bundle, so an update carrying a bumped `APP_BUILD` makes
the *current* binary misreport itself. Publish the OTA before the build-number
bump lands, or bump `JS_REVISION` and publish again afterwards. A build never
regresses to an older update: `LauncherSelectionPolicyFilterAware` picks the
matching-runtime update with the newest `commitTime`, and a fresh build's
embedded bundle is newer than anything published before it.

## Iterate on the device

**Default: publish an update, don't run a dev server.** Dispatch `step: update`,
then open the dev client — the published update appears in its launcher and
launches with no server involved. See D-014.

If live reload is genuinely worth it for a heavy editing session, a dev server
still works from a Codespace:

```bash
cd mobile && npx expo start --dev-client --tunnel
```

`--tunnel` is required, since the dev server is never on the phone's local
network. The terminal must stay alive for the whole session, which is why this
is the exception rather than the default.

---

## Publish taxtrail.app — Cloudflare, one-time

The domain is on Cloudflare Registrar, so DNS is already Cloudflare's. Reasoning
for this split is D-029; do these in order, each is verifiable on its own.

### 1. Email routing (do this first — it is the App Store blocker)

**The dashboard wording moves around.** Depending on the account you will find
this at **Compute → Email Service → Email Routing** (newer) or under the domain
itself at **Websites → taxtrail.app → Email → Email Routing** (older). If there
is no "Onboard Domain" button, you are on the older UI — use "Get started"
there; it does the same thing.

Order matters, and it is not obvious:

1. **Add a destination address** and click the verification link Cloudflare
   emails to it. Until that link is clicked, **every routing rule stays
   disabled** — that is documented behaviour, not a bug.
2. **Enable Email Routing on the zone.** This is the step that writes the MX,
   SPF and DKIM records. Adding a destination address alone does *not* do it.
3. **Create the rules**: pattern `support` → forward to the verified inbox, plus
   a catch-all to the same place.

**Diagnosing "the DNS records are empty".** Do not wait for propagation — a zone
on Cloudflare's own nameservers has no propagation delay for its own resolver.
Ask public DNS directly:

```bash
curl -sS -H 'accept: application/dns-json' \
  "https://cloudflare-dns.com/dns-query?name=taxtrail.app&type=MX"
```

An empty `Answer` with an SOA in `Authority` means the records genuinely do not
exist, so step 2 did not complete. This is what happened on 2026-08-10.

**Or let the workflow do it** — `.github/workflows/cloudflare.yml`, `step: email`
with `forward_to` set to the verified inbox. It enables routing, writes the
records, creates both rules, and reports whether the destination is verified.
`step: status` shows current DNS, routing state and rules without changing
anything.

### 2. Site hosting

Dispatch `.github/workflows/cloudflare.yml` with `step: pages`. It creates the
Pages project, deploys `site/` by direct upload, and attaches `taxtrail.app`.

Direct upload rather than the dashboard's "connect to Git" — linking a repo to
Pages needs a browser OAuth handshake with no API equivalent, and direct upload
runs from the same pipeline as everything else (D-031). The `site/` scoping is
unchanged and still the point: the retired PWA at the repo root is never served.

**Prerequisite, one time:** two repository secrets, Settings → Secrets and
variables → Actions:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | dash.cloudflare.com → My Profile → API Tokens → Create Token → Custom token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar, or the hex string in the dashboard URL |

Token permissions — least privilege, four lines:

| Scope | Resource | Level |
|---|---|---|
| Zone | Zone | Read |
| Zone | DNS | Edit |
| Zone | Email Routing Rules | Edit |
| Account | Cloudflare Pages | Edit |

Restrict zone resources to `taxtrail.app`. Never paste the token into a chat —
it belongs only in the GitHub secret, the same rule as `EXPO_TOKEN`.

### 3. Switch the app and the listing over — only after step 2 answers 200

```bash
curl -sSL -o /dev/null -w "%{http_code}\n" https://taxtrail.app/privacy.html
```

Must print `200`. Only then update `PRIVACY_URL` in
`mobile/src/components/FallbackPaywall.tsx` and the two URLs in
`docs/APP_STORE_LISTING.md`, and ship via `eas update`.

**Do not skip the check.** js r10 exists because the repo rename moved the Pages
path and left the paywall pointing at a 404 — and Guideline 3.1.2 requires a
working privacy link on the purchase screen.

### What NOT to do

**Never set a custom domain on this repo's GitHub Pages site.** GitHub then
redirects `fluke211.github.io/TaxTrail/` to it, which moves the origin. The
retired PWA's `localStorage` — holding Tyler's unexported receipts — is scoped to
`https://fluke211.github.io`, so the data would survive but nothing would be able
to read it. See D-029.

---

## Apple credential work (rare)

Needed when certificates expire (**31 May 2027**), a new test device is added,
or signing breaks. Cannot run in CI — `eas credentials` has no non-interactive
mode.

1. Create a Codespace on `main`. Setup runs `npm install` in `mobile/`.
2. In the terminal:
   ```bash
   npm i -g eas-cli
   eas login --no-browser
   ```
   `--no-browser` is essential. The default OAuth flow redirects to
   `http://localhost:<port>` **inside the container**, which a phone browser
   cannot reach.
3. Then:
   ```bash
   cd mobile && eas credentials:configure-build -p ios -e development
   ```
   Answer the Apple ID, password, and 2FA prompts. Say yes to generating a
   distribution certificate and registering the bundle identifier; select the
   target device.
4. Delete the Codespace afterward — idle ones consume the storage allowance.

Everything created is stored on Expo's servers, not in the Codespace.

---

## Test a purchase

**TestFlight builds do not need a sandbox account.** This is the thing that
gets re-derived every time, because Apple's own help page describes signing
into a Sandbox Apple Account and that is about a *different* build type.

- **TestFlight build** — runs against the sandbox backend using the tester's
  **real** Apple Account. The purchase sheet is headed "TestFlight" and says
  "For testing purposes only. You will not be charged for confirming this
  purchase." Seeing your own Apple ID on that sheet is the CORRECT outcome,
  not a misconfiguration. Do not sign out of Media & Purchases.
- **Development build** (the EAS dev client) — this is what consumes
  `Settings → Developer → Sandbox Apple Account`. Sign in there with a
  sandbox tester.

Either way, **never sign into iCloud with a sandbox account.** The three
logins are separate: iCloud (Settings → your name), Media & Purchases
(Settings → your name → Media & Purchases), and the Sandbox slot above.

### Renewal speed differs between the two, and it looks like a bug

| Environment | Renewal | Stops after |
|---|---|---|
| TestFlight | 1 per **day**, whatever the real duration | 6 renewals |
| Sandbox (dev build) | minutes — 1 month ≈ 5 min, 1 year ≈ 1 hour | 6 renewals |

So on TestFlight nothing renews for a day. That is expected; do not go looking
for a broken subscription.

### What still needs a sandbox tester

Clearing purchase history (only possible on a sandbox account, so it is the
only way back to a never-purchased state), billing-failure and
renewal-failure scenarios, and non-US storefronts.

Sandbox testers are scoped to the whole App Store Connect **team**, not to an
app, so the same accounts serve every app on the account. Their name, email
and password **can never be edited after creation** — only the region — so
make two or three at once and save the passwords immediately.

## Make App Store screenshots and the preview video

Full procedure in [`MAC_SETUP.md`](MAC_SETUP.md). The constraints that decide
the shape of it, so nobody re-derives them:

- **Apple requires iPhone screenshots taken on iOS**, and a **6.9-inch** set is
  mandatory for an iPhone app (1260×2736, 1290×2796 or 1320×2868 portrait).
  Android captures are not accepted, so Tyler's redroid/Maestro rig cannot
  produce store assets no matter how good it is.
- **Maestro drives simulators only** — physical iPhones are not officially
  supported — and simulators only run on macOS. A Mac is the whole path, not a
  convenience.
- **The iOS Simulator has no camera.** The capture flow cannot be exercised
  there. Screenshots go through the photo-library import path, with receipt
  images dragged onto the simulator window first. Simulator runs prove the UI
  and never the scanner, which is why the real corpus still has to come from a
  physical phone.

Cost: about 25 GB of disk on the borrowed machine (fully reclaimable), an
overnight Xcode download, and roughly an hour of setup. No money.

## Register a new device

Do it in a browser, not the CLI (`eas device:create` accepts no flags at all
and is purely interactive):

**expo.dev → account settings → Apple devices → Register Apple device**

Open the resulting link on the device being registered. Afterward the
provisioning profile must be regenerated to include it — see the credential
procedure above.

---

## Parser fixes

`mobile/src/lib/classifier.js` is the only copy that matters. **Do not port
anything back into `index.html`** — the PWA was retired at v5.5 (D-021) and
CLAUDE.md forbids touching it. This section used to say otherwise; it was wrong.

1. Add a regression fixture to `mobile/__tests__/` reproducing the bug. **Every
   reported parser bug gets a fixture** — that suite is the only thing keeping
   the classifier honest.
2. Fix `mobile/src/lib/classifier.js`.
3. `npm run test:unit` and `npm run test:synth` — both green, and the synthetic
   run must report no regressions against its baseline.
4. **Prove the fixture actually tests the fix.** `git stash push --
   src/lib/classifier.js`, re-run the suite, confirm the new tests FAIL, then
   `git stash pop`. A test that passes before and after documents behaviour
   rather than pinning a fix, which is worth knowing either way — but you
   should know which one you wrote.
5. Ship via OTA. Bump `JS_REVISION`.

### When the synthetic corpus goes quiet

If `npm run test:synth` reports 100% on every axis, it has stopped measuring the
parser and started measuring the generator. **Take the next hard case from
`__tests__/corpus/` — real Vision output — not from imagination.** That is how
the spaced decimal (`1. 49`) was found: it was sitting in `costco-1.txt` the
whole time, and the parser recovered the total on 12.6% of receipts carrying it
(D-045).

Add it as a named axis in `scripts/synth-corpus.js` and score it in
`scripts/score-synthetic.js`, so a failure names the format rather than the
receipt. Expect roughly half your guesses to be wrong — of the two axes added in
D-045, one was a real defect and the other was already handled. That is the
reason to measure both instead of fixing the one you assumed.

---

## Recovering a lost project

If `mobile/` is ever missing, `setup-receiptsnap-mobile.sh` reconstructs it from
the deployed PWA. **The reconstruction is not EAS-linked** — no `projectId`, and
it emits the old bundle identifier. Prefer restoring `mobile/` from git history.
