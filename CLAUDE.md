# ReceiptSnap — Project Instructions (CLAUDE.md)

Instructions for AI agents working on this repo. Tyler works with you directly —
he should never need to relay between assistants.

## Read the canon before you start. Update it as you go.

These five files are the project's memory. **Read them before touching
anything** — they exist so you don't rediscover what already cost someone time,
and so you don't reopen a settled question.

| File | What it answers |
|---|---|
| [`STATUS.md`](STATUS.md) | Where things stand right now, and what's blocked |
| [`DECISIONS.md`](DECISIONS.md) | Why things are the way they are — check before re-litigating |
| [`ROADMAP.md`](ROADMAP.md) | What's next, and what's deliberately parked |
| [`CHANGELOG.md`](CHANGELOG.md) | What shipped, and which version carries it |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | How to do a thing, and what it costs |

**Log as you go, in the same PR as the change** — not at the end of a session,
which is when it gets skipped. Concretely:

- Shipped something? `CHANGELOG.md`, under the version that carries it.
- Made a non-obvious call? `DECISIONS.md`, next free ID (check `git fetch` first
  — more than one session runs here, and IDs have collided before).
- Changed where the project stands, or hit a blocker? `STATUS.md`, and update
  its "Last updated" date.
- Finished or added a work item? `ROADMAP.md`.
- Worked out a procedure? `docs/RUNBOOK.md`, with what it costs.

A change that alters the situation and doesn't touch the canon is unfinished.
This file holds the rules; `STATUS.md` holds the situation.

## What this project is

ReceiptSnap: a privacy-first receipt scanner for US small-business taxes.
100% on-device OCR, no account, no cloud. Auto-categorizes into 29 tax categories
mapped to IRS Schedule C lines (+ Schedule A / Form 8829 / 4562 / COGS / Personal),
receipt splitting with tax-aware math, sales-tax tracking, CPA-ready exports
(CSV / XLSX / TXF / QuickBooks CSV).

Two artifacts:

1. **iOS app (Expo)** — `mobile/`. **The product.** EAS-configured and committed,
   so it is durable across sessions. Do not reconstruct it from the installer
   unless it is genuinely missing.
2. **PWA** — `index.html` at repo root, **RETIRED** at v5.5 (D-021). It was the
   proof of concept. **Do not modify or delete it**: Tyler still has receipts in
   its browser storage that he may export, and that storage is tied to the page
   at its current address.

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
  Tyler. Always preflight first (free). The free tier is 30 builds/month plus 10
  waived (failed builds aren't charged) — measured, see D-015 — so a failure is
  recoverable. Never spend one without asking. `step: usage` reports actual
  consumption.
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
- Canon updates ship **with the change**, not at session end — see the rule at
  the top of this file.
- More than one session runs in this repo. `git fetch origin main` before
  starting and before claiming a `DECISIONS.md` ID; they have collided before.
- **PRs are squash-merged, so reset the branch from `main` before every change**
  (`git checkout -B <branch> origin/main`). Skipping this makes the next PR
  conflict with your own already-merged commits — see `docs/RUNBOOK.md`.

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
- `classifier.js` + `exporters.js` originated in the PWA but are no longer kept
  in sync with it — the PWA is retired (D-021). `mobile/` is the only copy that
  matters; fix parser bugs there and do not port back.
- Storage: expo-sqlite (`src/lib/db.ts`); images as JPEGs under documentDirectory.
- Merchant / city tax-rate memory: `src/lib/memory.ts` (AsyncStorage),
  Dice-similarity fingerprints with a street-number digit gate.
- XLSX: SheetJS (`xlsx@0.18.5`, pure JS). exceljs does NOT work in RN — don't try.
- Tests: `npm run test:unit` — keep green; **add a fixture for every parser bug
  Tyler reports.** `npm run test:score` scores the parser over
  `__tests__/corpus/`, grown from the app's diagnostics export.

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
