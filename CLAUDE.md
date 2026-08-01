# ReceiptSnap — Project Instructions (CLAUDE.md)

You are taking over the ReceiptSnap project. This file is the complete handoff from
the Cowork session that built everything to date. Read it fully before acting.
Tyler works with you directly — he should never need to relay between assistants.

## What this project is

ReceiptSnap: a privacy-first receipt scanner for US small-business taxes.
100% on-device OCR, no account, no cloud. Auto-categorizes into 29 tax categories
mapped to IRS Schedule C lines (+ Schedule A / Form 8829 / 4562 / COGS / Personal),
receipt splitting with tax-aware math, sales-tax tracking, CPA-ready exports
(CSV / XLSX / TXF / QuickBooks CSV).

Two artifacts:
1. **PWA** — `index.html` at repo root. LIVE and deployed (Tyler's daily driver),
   currently **v5.5**. Single-file build; classifier + exporters are inlined in it.
   Do not modify unless Tyler explicitly asks.
2. **iOS app (Expo)** — **v1.0.0 (build 1)**, not yet built/installed. Complete and
   verified source, reconstructed by `setup-receiptsnap-mobile.sh` (repo root) into
   `~/receiptsnap-mobile`. Once EAS init/configure has been run, commit the project
   (minus node_modules, ios/, android/) into `mobile/` so future sessions inherit a
   configured project.

## Tyler's standing rules (do not drop these)

- **Version stamp discipline**: every deliverable carries a visible version. PWA
  shows it on the home screen; the Expo app shows it in the Summary footer via
  `src/lib/version.ts`. Bump `JS_REVISION` on every OTA update, `APP_BUILD` on
  every native build — and TELL Tyler which version you're handing him, every time.
- **Verify before recommending.** Never propose a path you haven't confirmed is
  technically possible. Dead ends burn his limited time.
- **Small command groups.** When Tyler must run/paste things, give one logical set
  at a time, never a full procedure — he gets stuck mid-list otherwise.
- **He is often phone-only** (iPhone). Prefer flows that are tap-driven or happen
  in chat. Terminal paste does NOT work on his phone; typing does.
- **EAS build quota is limited.** At most ONE build submission per explicit
  approval from Tyler. Preflight first (`npx expo-doctor`, `npx expo prebuild
  --platform ios --no-install`, then delete `ios/`). JS-only changes NEVER need a
  build — use the dev server or `eas update`.

## Environment intelligence (hard-won — do not re-litigate)

- **Claude Code remote sessions: `api.expo.dev` is BLOCKED** (gateway network
  policy, not a config issue). All `eas *` commands are impossible there.
  GitHub push works fine. npm registry + raw.githubusercontent work.
- **All EAS work happens in Tyler's GitHub Codespace** on this repo:
  `.devcontainer/devcontainer.json` auto-runs the installer on container create
  (log: `~/receiptsnap-setup.log`); `.vscode/tasks.json` provides tap-to-run
  tasks 1–5 (verify → login → init+OTA → device registration → build). Tyler runs
  them from Terminal → Run Task, typing only credentials.
- The Cowork (claude.ai) session that built this cannot push to GitHub (read-only
  connector) and cannot reach expo/fast.io either. Its role now: PWA work,
  analysis/docs, and anything not requiring GitHub-write or Expo.

## The immediate mission (in order)

1. **Codespace bring-up**: fresh Codespace → installer auto-runs (~4–5 min) →
   Task 1 must show "10 passed, 0 failed" + clean tsc.
2. **Task 2** `eas login` (Tyler types Expo credentials), **Task 3** `eas init` +
   `eas update:configure` (REQUIRED before building — OTA config is baked into the
   binary), **Task 4** `eas device:create` → website method → Tyler opens the URL
   on his iPhone, **Task 5** the ONE dev build. EAS manages Apple signing via
   Tyler's Apple Developer login at the prompts.
3. **Durability commit**: after init/configure, commit `~/receiptsnap-mobile` →
   `mobile/` in this repo (exclude node_modules, ios/, android/, any secrets).
4. **On-device iteration**: `npx expo start --dev-client --tunnel` from the
   Codespace; Tyler scans the QR. Parser fixes: Tyler long-presses... (diagnostic
   tooling exists in the PWA; port to the app is a later task). JS fixes ship via
   `eas update --channel development` + bump `JS_REVISION`.

## Monetization plan (implement after the dev build works)

Decided and researched (full analysis: `MARKET_AND_GTM_STRATEGY.md` at repo root):
- **No ads, ever** — especially not OCR-derived targeting (economics lose to
  subscriptions 2–5x AND it destroys the "Data Not Collected" privacy label,
  the app's core differentiator).
- RevenueCat: entitlement `pro`, offering `default`, products
  `receiptsnap_pro_monthly` $6.99 / `receiptsnap_pro_annual` $39.99 (7-day trial,
  highlighted default) / `receiptsnap_pro_lifetime` $99.99 (non-consumable).
  App Store Connect subscription group: "ReceiptSnap Pro".
- Free tier: 10 scans/month + CSV export (enforced in `src/lib/purchases.ts` +
  `src/lib/config.ts`; `FREE_SCANS_PER_MONTH`).
- RevenueCat public Apple API key goes in `src/lib/config.ts` — JS-only, OTA-safe.
  Placeholder `appl_REPLACE_ME` keeps the app fully functional in free mode.
- Enroll App Store Small Business Program (15%) at launch.
- Launch timing: soft-launch ASAP; the revenue window is Jan 1–Apr 15 (tax
  season; installs run ~5x). GTM calendar is in the strategy doc.

## Architecture notes (Expo app)

- Expo SDK 55, RN 0.83, New Architecture, TypeScript. Min iOS 15.1.
- No navigation library (custom 3-tab shell in App.tsx) — deliberate, to minimize
  native surface for the single dev build. Don't add native deps casually; every
  native addition requires a new build (see quota rule).
- OCR: `expo-text-extractor` (Apple Vision) — returns ordered text lines,
  joined with \n and fed to `src/lib/classifier.js`.
- `classifier.js` + `exporters.js` are SHARED with the PWA and must stay in sync.
  The installer extracts them from the deployed `index.html` (v5.5, includes the
  Costco FSA + OCR-decimal fixes). If the PWA parser advances, re-extract or port.
- Storage: expo-sqlite (`src/lib/db.ts`); images as JPEGs under documentDirectory.
- Merchant memory / city tax-rate memory: `src/lib/memory.ts` (AsyncStorage),
  Dice-similarity fingerprints with a street-number digit gate.
- XLSX: SheetJS (`xlsx@0.18.5`, pure JS). exceljs does NOT work in RN — don't try.
- Tests: `npm run test:unit` (classifier regression incl. real-receipt fixtures) —
  keep green; add a fixture for every parser bug Tyler reports.

## Guardrails

- Never commit tokens, .p8 keys, or credentials. EXPO_TOKEN only as an env var.
- Never run more than one `eas build` without Tyler's explicit go.
- Don't touch `index.html` (live PWA) or `setup-receiptsnap-mobile.sh` unless the
  task is specifically about them.
- If blocked on something only Tyler can do (open a URL, type a password, approve
  spend), STOP and ask with ONE clear, small action.

— Handed off 2026-08-01 by the Cowork session (installer sha256 559edb61…,
verified byte-identical against the pushed copy; all context above is current
as of that date).
