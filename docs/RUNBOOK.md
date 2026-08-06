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
