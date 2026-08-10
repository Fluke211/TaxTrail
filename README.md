# TaxTrail

A privacy-first receipt scanner for US small-business taxes. 100% on-device OCR,
no account, no cloud. Auto-categorizes receipts into 29 tax categories mapped to
IRS Schedule C lines (plus Schedule A, Form 8829, Form 4562, COGS, and Personal),
with receipt splitting, tax-aware math, sales-tax tracking, and CPA-ready exports
(CSV / XLSX / TXF / QuickBooks CSV).

The differentiator is the App Store privacy label: TaxTrail can ship
**"Data Not Collected"** while every meaningful competitor requires an account
and cloud processing.

## Two artifacts

| | PWA | iOS app |
|---|---|---|
| Location | `index.html` (repo root) | `mobile/` |
| Version | **v5.5** | **v1.0.0 (build 1)** |
| Status | Live, deployed via GitHub Pages | Development client |
| Build | Single self-contained file | Expo SDK 55 · RN 0.83 · New Architecture |

The PWA is Tyler's daily driver. **Do not modify `index.html` unless explicitly
asked** — it is deployed from `main`.

`classifier.js` and `exporters.js` are shared between both artifacts and must
stay in sync. `setup-receiptsnap-mobile.sh` extracts them from the deployed PWA.

## Where to look

| Document | Purpose |
|---|---|
| [`STATUS.md`](STATUS.md) | Where the project is right now. Read this first. |
| [`CLAUDE.md`](CLAUDE.md) | Instructions for AI agents working on this repo |
| [`DECISIONS.md`](DECISIONS.md) | Why things are the way they are — read before re-litigating |
| [`ROADMAP.md`](ROADMAP.md) | What's next, aligned to the tax-season calendar |
| [`CHANGELOG.md`](CHANGELOG.md) | Version history for both artifacts |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | How to ship an update, run a build, add a dependency |
| [`MARKET_AND_GTM_STRATEGY.md`](MARKET_AND_GTM_STRATEGY.md) | Market analysis, pricing, go-to-market |

## Repository layout

```
index.html                      Live PWA (v5.5) — deployed via GitHub Pages
mobile/                         Expo iOS app, EAS-configured
  app.json                      Bundle ID, EAS projectId, OTA URL, permissions
  eas.json                      Build profiles (development / preview / production)
  src/lib/classifier.js         Receipt parser — shared with the PWA
  src/lib/exporters.js          CSV / XLSX / TXF / QuickBooks — shared with the PWA
  src/lib/version.ts            Version stamp shown in the app
  __tests__/                    Classifier regression tests incl. real receipts
setup-receiptsnap-mobile.sh     Reconstructs the Expo project from scratch
.github/workflows/eas.yml       Runs EAS CLI in CI (see below)
.devcontainer/ .vscode/         Codespace setup for interactive credential work
docs/                           Operational documentation
```

## How work gets done here

Two environment constraints shape everything:

1. **Claude Code remote sessions cannot reach any Expo domain.** `api.expo.dev`,
   `expo.dev`, and `u.expo.dev` are all refused by the network gateway. npm and
   GitHub work fine.
2. **Tyler is frequently iPhone-only**, and terminal paste does not work there.

So EAS CLI work runs on **GitHub Actions runners**, which have unrestricted
network access. Runs are dispatched and their logs read through the GitHub API,
which means an agent can drive and debug the whole pipeline while Tyler only
taps in a browser. See [`docs/RUNBOOK.md`](docs/RUNBOOK.md).

The one thing CI cannot do is authenticate to Apple, because
`eas credentials` has no non-interactive mode. That is what the Codespace is
for, and it is a rare, one-time trip.

## Quick facts

| | |
|---|---|
| EAS project | `@tylerthornbrue/receiptsnap` |
| Project ID | `d98a6958-bf2b-43c6-8ced-6e3953f0d11f` |
| Bundle ID | `com.tylerthornbrue.taxtrail` |
| OTA updates URL | `https://u.expo.dev/d98a6958-bf2b-43c6-8ced-6e3953f0d11f` |
| Apple Team | `5M67JT29GJ` (Tyler Thornbrue, Individual) |
| Repo secret | `EXPO_TOKEN` — used by the EAS workflow, never printed |

## Tests

```bash
cd mobile && npm run test:unit    # classifier regression, incl. real-receipt fixtures
npx tsc --noEmit                  # must be clean
```

Add a fixture for every parser bug reported. The suite is the guard against
regressions in the shared classifier.
