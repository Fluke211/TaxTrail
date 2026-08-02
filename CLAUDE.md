# ReceiptSnap — Project Instructions (CLAUDE.md)

Instructions for AI agents working on this repo. Tyler works with you directly —
he should never need to relay between assistants.

**Read [`STATUS.md`](STATUS.md) first** — it holds the current state and any
active blocker. This file holds the rules; `STATUS.md` holds the situation.

## What this project is

ReceiptSnap: a privacy-first receipt scanner for US small-business taxes.
100% on-device OCR, no account, no cloud. Auto-categorizes into 29 tax categories
mapped to IRS Schedule C lines (+ Schedule A / Form 8829 / 4562 / COGS / Personal),
receipt splitting with tax-aware math, sales-tax tracking, CPA-ready exports
(CSV / XLSX / TXF / QuickBooks CSV).

Two artifacts:

1. **PWA** — `index.html` at repo root. LIVE and deployed via GitHub Pages
   (Tyler's daily driver), currently **v5.5**. Single-file build; classifier and
   exporters are inlined. Do not modify unless Tyler explicitly asks.
2. **iOS app (Expo)** — `mobile/`, **v1.0.0 (build 1)**. EAS-configured and
   committed, so it is durable across sessions. Do not reconstruct it from the
   installer unless it is genuinely missing.

## Tyler's standing rules (do not drop these)

- **Version stamp discipline**: every deliverable carries a visible version. PWA
  shows it on the home screen; the Expo app shows it in the Summary footer via
  `src/lib/version.ts`. Bump `JS_REVISION` on every OTA update, `APP_BUILD` on
  every native build — and TELL Tyler which version you're handing him, every time.
- **Verify before recommending.** Never propose a path you haven't confirmed is
  technically possible. Dead ends burn his limited time. Check `--help` output,
  inspect package internals, run `prebuild` and read what it generated. This has
  repeatedly caught things that reasoning-from-memory would have gotten wrong.
- **Small command groups.** When Tyler must run or paste things, give one logical
  set at a time, never a full procedure — he gets stuck mid-list otherwise.
- **He is often phone-only** (iPhone). Prefer flows that are tap-driven or happen
  in chat. **Terminal paste does NOT work on his phone; typing does.** Browser
  paste works fine.
- **EAS build quota.** At most ONE build submission per explicit approval from
  Tyler. Always preflight first (free). The free tier is ~15 iOS builds/month, so
  a failure is recoverable — but never spend one without asking.
- **JS-only changes NEVER need a build.** Use `eas update` or the dev server.

## Environment intelligence (hard-won — do not re-litigate)

- **Claude Code remote sessions: every Expo domain is BLOCKED.** `api.expo.dev`,
  `expo.dev`, `u.expo.dev`, `exp.host`, `cdn.expo.dev`, `docs.expo.dev` all
  return a gateway 403. Not a config issue; no workaround.
  `api.appstoreconnect.apple.com` is blocked too. npm registry, GitHub, and
  `raw.githubusercontent.com` work.
- **So EAS CLI work runs in GitHub Actions** — `.github/workflows/eas.yml`.
  Runners have unrestricted network access, and an agent can dispatch runs and
  read logs through the GitHub API. This is the primary EAS interface.
- **The Codespace is only for interactive Apple authentication**, which CI
  cannot do — neither `eas credentials` nor `eas credentials:configure-build`
  accepts `--non-interactive`.
- **`eas login` must use `--no-browser`** in a Codespace. The default OAuth flow
  redirects to `localhost` *inside the container*, which a phone cannot reach.
- **The App Store Connect `.p8` download fails on iOS**, in Safari and Chrome,
  desktop and mobile modes. Don't send Tyler down that path again.
- **`eas device:create` accepts no flags at all.** Register devices through the
  expo.dev dashboard in a browser instead.

## Working agreement

- Work on the designated feature branch, open a PR, merge to `main`. `main` is
  the single source of truth.
- **Update `STATUS.md` at the end of every session.** It is how the next session
  — or the next agent — knows where things stand.
- Record non-obvious choices in `DECISIONS.md`. If you find yourself about to
  re-litigate something, check there first.
- Operational procedures live in `docs/RUNBOOK.md`. Extend it rather than
  re-deriving a procedure.

## Architecture notes (Expo app)

- Expo SDK 55, RN 0.83, New Architecture, TypeScript. Min iOS 15.1.
- No navigation library (custom 3-tab shell in `App.tsx`) — deliberate, to
  minimize native surface. Every native addition requires a new build.
- **Check New Architecture compatibility before adding any non-Expo native
  package** — look for `codegenConfig` in its `package.json`. RN 0.83 has no
  legacy bridge fallback.
- **After any config-plugin change, inspect the generated `Info.plist`.** Plugins
  add permissions silently — `expo-image-picker` adds a microphone request,
  `expo-location` adds always-on location. For an app whose differentiator is the
  "Data Not Collected" label, an unexplained permission is corrosive. See D-007.
- **Entitlements can invalidate an existing provisioning profile.** Adding
  `expo-notifications` injects `aps-environment`, which a profile created before
  it will not carry — the build then fails at signing. Adding an
  entitlement-bearing module means redoing credentials. See D-011.
- OCR: `expo-text-extractor` (Apple Vision) — returns ordered text lines, joined
  with `\n` and fed to `src/lib/classifier.js`. The engine is as good as it gets;
  **what limits accuracy is the image quality handed to it.**
- `classifier.js` + `exporters.js` are SHARED with the PWA and must stay in sync.
- Storage: expo-sqlite (`src/lib/db.ts`); images as JPEGs under documentDirectory.
- Merchant / city tax-rate memory: `src/lib/memory.ts` (AsyncStorage),
  Dice-similarity fingerprints with a street-number digit gate.
- XLSX: SheetJS (`xlsx@0.18.5`, pure JS). exceljs does NOT work in RN — don't try.
- Tests: `npm run test:unit` — keep green; **add a fixture for every parser bug
  Tyler reports.**

## Monetization

Decided and researched. Summary in `DECISIONS.md` D-001/D-002; full analysis in
`MARKET_AND_GTM_STRATEGY.md`. Headlines: **no ads, ever**; Pro at
$6.99/mo · $39.99/yr · $99.99 lifetime; free tier 10 scans/month; RevenueCat with
entitlement `pro`; App Store Small Business Program at launch. All of it is JS
and dashboard configuration — none of it needs a native build.

## Guardrails

- Never commit tokens, `.p8` keys, or credentials. `EXPO_TOKEN` lives in GitHub
  secrets and is never printed.
- Never run more than one `eas build` without Tyler's explicit go.
- Don't touch `index.html` (live PWA) or `setup-receiptsnap-mobile.sh` unless the
  task is specifically about them.
- If blocked on something only Tyler can do (open a URL, type a password, approve
  spend), STOP and ask with ONE clear, small action.
