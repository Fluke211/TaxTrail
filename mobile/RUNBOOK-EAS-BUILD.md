# ReceiptSnap Mobile — Single-Dev-Build Runbook

Goal: **one** EAS development build, then unlimited iteration without another build.
Everything that requires native code is already compiled into this project's
dependency list — verified by `expo prebuild`, Metro bundling, and autolinking
resolution (26 Expo modules + RevenueCat/safe-area/async-storage pods) before handoff.

**Why one build is enough:** all future changes fall into two classes.
JS/TS/asset changes (screens, parser fixes, pricing, paywall config, xlsx builder)
reach the dev build via `npx expo start --dev-client` during development and via
`eas update` over the air later. Only a NEW native module or app.json plugin change
would need another build — and every native module this app will need through App
Store launch is already in.

---

## Step 1 — Unpack & install (your machine, 5 min)

```bash
unzip receiptsnap-mobile.zip && cd receiptsnap-mobile
npm install
npm run test:unit        # should print "10 passed, 0 failed"
npx tsc --noEmit         # should print nothing (clean)
```

## Step 2 — Link your Expo account (one time)

```bash
npx eas-cli@latest login
npx eas init             # creates the EAS project, writes projectId into app.json
npx eas update:configure # writes updates.url — REQUIRED BEFORE BUILDING (OTA is baked in at build time)
```

Say yes to any "commit changes?" prompts. Do NOT skip `eas update:configure` —
if the build is made without it, over-the-air updates can never reach that build.

## Step 3 — Register your iPhone (BEFORE the build)

```bash
npx eas device:create
```

Open the QR/URL it prints **on your iPhone** and install the provisioning profile.
Devices registered AFTER a build require a rebuild — register the phone (and any
family testers' phones) first.

## Step 4 — The one development build

```bash
npx eas build --profile development --platform ios
```

- Choose "Yes" to let EAS manage credentials (it uses your Apple Developer login).
- ~15–25 min on the free-tier queue. You get an install QR/URL at the end —
  open it on your iPhone to install the ReceiptSnap dev client.

## Step 5 — Daily development (no builds, ever)

```bash
npx expo start --dev-client
```

Scan the QR with the iPhone camera → the dev client opens and hot-reloads all
JS changes live. This is where we iterate on parser accuracy, UI, paywall, etc.

## Later — shipping JS fixes over the air (still no build)

```bash
npx eas update --channel development --message "parser fix"
```

(Dev client: Extensions tab → load the update. Production builds on the
`production` channel get updates automatically at launch.)

---

## RevenueCat setup (no build required — do anytime)

1. app.revenuecat.com → new project "ReceiptSnap" → add App Store app with
   bundle ID `com.tylerthornbrue.receiptsnap`.
2. App Store Connect → create subscription group **ReceiptSnap Pro** with:
   - `receiptsnap_pro_monthly` — $6.99/mo
   - `receiptsnap_pro_annual` — $39.99/yr with 7-day free trial
   - and a non-consumable `receiptsnap_pro_lifetime` — $99.99
3. RevenueCat: entitlement `pro` ← attach all three products; offering `default`.
4. Paste the public Apple API key (starts `appl_`) into `src/lib/config.ts`.
5. Optional: build a Paywall in the RevenueCat dashboard — the app presents it
   automatically (falls back to a plain purchase sheet if none is configured).

Sandbox testing: App Store Connect → Users and Access → Sandbox Testers.

## Production, when ready

```bash
npx eas build --profile production --platform ios --auto-submit
```

(Separate from the dev build; expected cost: 1 build per store release.
Free tier = 15 iOS builds/month — plenty.)

## Guardrails

- **Never `npm install` a package containing native code** (anything needing
  `expo prebuild` changes) without planning a rebuild. Pure-JS packages are fine.
- `app.json` plugins/bundleIdentifier/buildNumber changes ⇒ rebuild required.
- To swap SheetJS to the newer CDN build (optional, pure JS):
  `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- Version stamp lives in `src/lib/version.ts` — bump `JS_REVISION` on every
  `eas update`, `APP_BUILD` on every native build.
