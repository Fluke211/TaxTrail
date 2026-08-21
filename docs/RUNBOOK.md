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

Quota (free plan, verified 2026-08-02): **30 builds/month**, plus **10 waived
builds/month** — a failed build is waived rather than charged, so a failure is
cheap, though the waiver pool is account-wide and finite. Check consumption with
the `usage` step rather than counting by hand.

---

## Reset the branch after every merge — do this first

PRs are **squash**-merged, so the feature branch's commits never become
ancestors of `main`. Keep working on the old branch and the next PR conflicts
with your own already-merged work. This has bitten four times.

Before starting any change:

```bash
git fetch origin main && git checkout -B <branch> origin/main
```

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

---

## Add a native dependency

This costs a build, so batch them.

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
4. Verify New Architecture compatibility for non-Expo packages — look for
   `codegenConfig` in the package's `package.json`. RN 0.83 has no legacy
   bridge fallback.
5. Preflight in CI, then request approval for the build.
6. Bump `APP_BUILD` in `mobile/src/lib/version.ts`.

---

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
against it, and it has no `expo-document-picker`, so the Restore button added in
js r12 fails there. It is still fine for parser and UI work; it is not a place
to test anything involving purchases or restore.

**Default to TestFlight + `--branch production`.** It is the actual shipping
artifact, purchases work against the matching bundle identifier, and JS changes
still land in seconds without a build or a review. TestFlight builds expire
after 90 days.

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

## Register a new device

Do it in a browser, not the CLI (`eas device:create` accepts no flags at all
and is purely interactive):

**expo.dev → account settings → Apple devices → Register Apple device**

Open the resulting link on the device being registered. Afterward the
provisioning profile must be regenerated to include it — see the credential
procedure above.

---

## Parser fixes

The classifier is shared between the PWA and the app and must stay in sync.

1. Add a regression fixture to `mobile/__tests__/` reproducing the bug. **Every
   reported parser bug gets a fixture** — that suite is the only thing keeping
   the shared classifier honest.
2. Fix `mobile/src/lib/classifier.js`.
3. `npm run test:unit` — all green.
4. Port the same fix to `index.html` (the PWA inlines its own copy), or
   re-extract if the PWA is ahead.
5. Ship via OTA. Bump `JS_REVISION`.

---

## Recovering a lost project

If `mobile/` is ever missing, `setup-receiptsnap-mobile.sh` reconstructs it from
the deployed PWA. **The reconstruction is not EAS-linked** — no `projectId`, and
it emits the old bundle identifier. Prefer restoring `mobile/` from git history.
