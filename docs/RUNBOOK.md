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
| **EAS build** | **1 of ~15/month** | **Yes — explicit approval** |
| Apple credential work | Free, but a Codespace trip | Yes — types Apple password + 2FA |

**JS-only changes never need a build.** Anything in `src/`, including the
classifier, screens, and exporters, ships over the air.

---

## Ship a JS change (the common case)

1. Edit under `mobile/src/`.
2. Bump `JS_REVISION` in `mobile/src/lib/version.ts`.
3. Run the tests: `cd mobile && npm run test:unit && npx tsc --noEmit`.
4. Commit, push, open a PR, merge to `main`.
5. Publish the update:
   ```bash
   cd mobile && eas update --channel development --message "what changed"
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

```bash
cd mobile && npx expo start --dev-client --tunnel
```

Tyler scans the QR with the dev client installed. `--tunnel` is required when
the dev server isn't on his local network — which, running from CI or a
Codespace, it never is.

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
