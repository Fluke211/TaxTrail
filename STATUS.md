# Status

**Last updated:** 2026-08-02 · Update this file at the end of every working session.

| Artifact | Version | State |
|---|---|---|
| PWA (`index.html`) | **v5.5** | Live, deployed via GitHub Pages. Untouched this session. |
| iOS app (`mobile/`) | **v1.0.0 (build 1) · js r1** | Not yet built successfully — see blocker below |

---

## Current blocker

**The first EAS build failed on code signing.** Not the app code — the profile.

```
Provisioning profile "*[expo] com.tylerthornbrue.receiptsnap AdHoc ..."
doesn't include the Push Notifications capability.
... doesn't include the aps-environment entitlement.
```

Cause: `expo-notifications` injects the `aps-environment` entitlement, and the
provisioning profile was created ~40 minutes *before* that module was added. The
profile has no Push Notifications capability, so Xcode refused to sign.

Confirmed there is no way around it in config — the plugin sets the entitlement
unconditionally (`if (!config.modResults['aps-environment'])`, so any falsy
override is overwritten). `expo-notifications` cannot exist without the push
entitlement.

**Two ways forward:**

- **Drop `expo-notifications`, rebuild.** One build, no work for Tyler.
  Notifications are a Nov–Dec feature, and the Sep–Oct production build needs
  fresh credentials anyway (App Store profile, not ad-hoc) — the natural moment
  to enable the capability.
- **Keep it, regenerate the profile with Push Notifications.** Requires an
  interactive Apple sign-in, so another Codespace trip, plus a build.

**Not yet known:** whether the document scanner's Swift compiles against RN 0.83.
The build failed at signing, before compilation, so that question is still open.

Builds used: **1**. Quota is ~15/month.

---

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

## Next

1. Resolve the signing blocker (decision above), rebuild
2. Install the dev client on Tyler's iPhone, confirm it scans and parses
3. Wire the document scanner into the capture flow — the OCR accuracy work

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
- **RevenueCat: dashboard side IN PROGRESS (2026-08-02, driven from Atlas via
  the RevenueCat MCP).** Done: project **`proj63a7fa32`** created; restore
  behavior set to "Transfer if there are no active subscriptions" (D-012);
  App Store Connect app record created as **"ReceiptSnap: Expense Organizer"**
  (D-013), bundle `com.tylerthornbrue.receiptsnap`. Queued next in that
  session (it works in checkpointed stages): RC iOS app + Apple keys, the
  three products — `receiptsnap_pro_monthly` $6.99, `receiptsnap_pro_annual`
  $39.99 with the 7-day (`ONE_WEEK`) trial, `receiptsnap_pro_lifetime` $99.99
  as a **non-consumable outside the subscription group** — entitlement `pro`
  (all three attached), offering `default` with standard `$rc_monthly` /
  `$rc_annual` / `$rc_lifetime` packages, then the public `appl_` key.
  `src/lib/config.ts` still holds `appl_REPLACE_ME` (app stays functional in
  free mode) until that key exists. **No webhook — no backend exists, by
  design** (D-012); SDK entitlement checks are client-side.
- **Apple credentials expire 31 May 2027** and renewal is an interactive trip.
- **Two Codespaces exist** (`curly guacamole`, `potential train`). Delete both
  once credential work is finished — idle ones consume the storage allowance.

## Session log

**2026-08-02** — Established the Actions-based EAS pipeline; created and
configured the EAS project; committed the project to `mobile/`; set up Apple
credentials interactively; changed the bundle identifier; added seven native
dependencies and audited the resulting permissions; first build attempted and
failed on the push entitlement; wrote this documentation set.
Separately (Atlas RevenueCat session): RevenueCat project `proj63a7fa32`
created, restore behavior set, and the App Store Connect app record created as
"ReceiptSnap: Expense Organizer" — plain "ReceiptSnap" and several
permutations were taken (D-013). Product/entitlement/offering configuration is
queued behind that session's checkpoint flow; see the RevenueCat open item
above and D-012.

**2026-08-01** — Repo seeded: installer script, devcontainer, task runner, GTM
strategy, `CLAUDE.md` handoff.
