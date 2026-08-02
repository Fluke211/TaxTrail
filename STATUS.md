# Status

**Last updated:** 2026-08-02 · Update this file at the end of every working session.

| Artifact | Version | State |
|---|---|---|
| PWA (`index.html`) | **v5.5** | Live, deployed via GitHub Pages. Untouched this session. |
| iOS app (`mobile/`) | **v1.0.0 (build 1) · js r1** | Built and installable — see below |

---

## Current state

**The development client is built and installable.**

| | |
|---|---|
| Build ID | `c0d5ebc3-8439-4333-aaa0-503feab787d2` |
| Install | https://expo.dev/accounts/tylerthornbrue/projects/receiptsnap/builds/c0d5ebc3-8439-4333-aaa0-503feab787d2 |
| Version | **v1.0.0 (build 1) · js r1** |
| Profile | `development` — dev client, ad-hoc internal distribution |
| Provisioned device | iPhone `00008110-000969302ED3A01E` |

Open the link on the registered iPhone to install.

**Resolved:** the first attempt failed on code signing because `expo-notifications`
injects the `aps-environment` entitlement and the provisioning profile predated
that module (D-011). Dropping the module cleared it.

**Answered:** `react-native-document-scanner-plugin` compiles against RN 0.83.
The full Xcode build passed, so VisionKit document capture, camera, Face ID,
print, haptics, and location are all live in this client.

**Builds used: 2** — one ERRORED (signing), one FINISHED. Verified via the
workflow's `usage` step, not by hand. Quota is ~15/month; whether the errored
build is billed is an EAS policy question, checkable at
https://expo.dev/accounts/tylerthornbrue/settings/billing

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
- [x] Bundle ID settled: `com.tylerthornbrue.receiptsnap`
- [x] Native dependency set chosen and installed
- [x] Permission surface audited and minimized
- [x] CI preflight green: **expo-doctor 19/19**, `expo prebuild` succeeds
- [x] **iOS development client built successfully**

## Next

1. Install the dev client on Tyler's iPhone; confirm it launches, scans, and parses
2. Wire the document scanner into the capture flow — the OCR accuracy work.
   All JS from here, so it ships via `eas update` with no further builds
3. Delete both Codespaces (`curly guacamole`, `potential train`) — done with them

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

- **No standalone CI on pull requests.** Tests only run when the EAS workflow is
  dispatched manually. A push/PR-triggered test workflow would catch regressions
  automatically.
- **`setup-receiptsnap-mobile.sh` emits the old bundle ID** (`com.vaultvision.*`)
  and produces a project with no EAS `projectId`. Left byte-unchanged per the
  guardrail; `mobile/` is authoritative. The fallback paths warn about this.
- **Android was never audited.** The duplicated `RECORD_AUDIO` permission was
  removed, but the whole Android surface needs a pass before Android is taken
  seriously.
- **RevenueCat is unconfigured.** `src/lib/config.ts` holds the placeholder
  `appl_REPLACE_ME`, which keeps the app functional in free mode.
- **Apple credentials expire 31 May 2027** and renewal is an interactive trip.
- **Two Codespaces exist** (`curly guacamole`, `potential train`). Delete both
  once credential work is finished — idle ones consume the storage allowance.

## Session log

**2026-08-02** — Established the Actions-based EAS pipeline; created and
configured the EAS project; committed the project to `mobile/`; set up Apple
credentials interactively; changed the bundle identifier; added native
dependencies and audited the resulting permissions; wrote this documentation
set. First build failed on the push entitlement; dropped `expo-notifications`
and the second build succeeded. **Dev client v1.0.0 (build 1) is installable.**

**2026-08-01** — Repo seeded: installer script, devcontainer, task runner, GTM
strategy, `CLAUDE.md` handoff.
