# ReceiptSnap — Market Analysis, Pricing & Go-to-Market Strategy

**Prepared:** August 1, 2026 · **For:** Tyler Thornbrue · **Objective:** maximize profit on the iOS launch

All facts below were verified against primary sources August 1, 2026 (App Store listings, official pricing pages, IRS SOI, RevenueCat State of Subscription Apps 2026, Apple/Google developer docs). Source URLs are in the research appendix section at the end.

---

## 1. Executive summary

ReceiptSnap enters a market with ~31M US Schedule C filers and ~60M 1099 recipients where **every meaningful competitor requires an account and cloud processing**. The "100% on-device, no account, data never leaves your phone" position is validated (reviewers actively recommend the one semi-offline incumbent *because* of it) and unoccupied — only two micro-apps with 1 rating each claim it. The moat is the App Store privacy label itself: ReceiptSnap can ship **"Data Not Collected"** while Keeper, QuickBooks, and Wave show identity-linked financial data used for advertising. That contrast is screenshot-able marketing.

**Recommendation: subscription + high-priced lifetime, NO ads.** Realistic ad revenue for this category is $0.25–0.70 per active free user per year; the subscription funnel already implies $0.68–1.70 per free user in year one at median conversion — and receipt-keyword-targeted ads would legally and practically destroy the privacy claim that drives that conversion (details §4).

**Pricing:** Pro at **$6.99/mo, $39.99/yr (7-day trial, default), $99.99 lifetime**. Free tier: 10 scans/month with full parsing + CSV. Enroll in the App Store Small Business Program (15% commission, confirmed current).

**Timing:** launch the native app Sep–Oct 2026 as a soft launch; the category's demand is extremely seasonal (Keeper's installs run ~5x in late January; tax apps collapse −98% after April 15). Use the fall to accumulate ratings and keyword rank, stage tax-season creative by mid-December, and treat Jan 1–Apr 15 as the revenue year.

---

## 2. Market analysis

### 2.1 Market size
- **30.98M** nonfarm sole-proprietor (Schedule C) returns, TY2022 — latest verified IRS SOI figure; Census counts 30.4M nonemployer firms (2023). Serviceable market ≈ **30M US solo-business filers**.
- **~60.5M** Form 1099-NEC filings projected CY2025. The 1099-K threshold reverted to $20,000/200 transactions for TY2025+ — millions of gig sellers now get **no platform tax form** and must self-track expenses. Direct tailwind.
- Expense-management software: $7.5B (2025) → $8.5B (2026) at 13% CAGR (enterprise-heavy; directional only).

### 2.2 Competitive landscape (verified Aug 2026)

| App | Rating | Price | Cloud/account? | Schedule C? |
|---|---|---|---|---|
| Expensify | 4.6★ (156K) | $4.99/mo individual | Yes | No |
| Dext | 4.8★ (7.1K) | $34.99/mo+ (no free tier) | Yes | No |
| Shoeboxed | 4.5★ (1.8K) | $9–179/mo | Yes + humans read receipts | No |
| Foreceipt | 4.7★ (6.6K) | $6.99/mo, $59.99/yr; free = 100 receipts + ads | Yes | No |
| Smart Receipts | 4.8★ (13K) | $29.99 one-time or $99.99/yr | Semi | No |
| Keeper | 4.8★ (13K) | $20/mo; $199–399/yr | Yes — bank linking | **Yes** |
| QuickBooks Solopreneur | 4.7★ (253K) | free: 2 receipts/mo; $20–38/mo | Yes | **Yes** |
| Wave | 4.4★ (6.6K) | receipts = $8/mo add-on | Yes | No |
| SparkReceipt | 4.8★ (810) | $8.99/mo, $69.99/yr | Yes | No |
| Recu (micro-app) | 1 rating | $9.99 one-time | **No — on-device** | No |

**Structural findings:**
1. **On-device/no-account is empty.** The only occupants have 1 rating each. First credible mover owns the position — ship fast.
2. **Schedule C categorization is rare** — only Keeper ($199/yr) and QuickBooks ($240/yr) do it, both cloud. ReceiptSnap does it on-device at a fraction of the price.
3. The individual-tier price umbrella is **$4.99–8.99/mo**; $39.99/yr undercuts every credible competitor's annual (Foreceipt $59.99, SparkReceipt $69.99, Wave $72–96, Smart Receipts PRO $99.99, Keeper $199).
4. **Marketable churn events:** Dext/IRIS price hikes, Wave paywalling receipts, QuickBooks Self-Employed shutdown, Keeper's auto-charging trial complaints, Smart Receipts' open-source-to-subscription conversion. Each is an audience actively looking to switch.

---

## 3. Pricing (optimized for profit)

### 3.1 The structure

| Tier | Price | Contents |
|---|---|---|
| **Free** | $0 | 10 scans/month, full OCR + Schedule C auto-categorization, splits, sales-tax tracking, CSV export, local backup |
| **Pro monthly** | **$6.99/mo** | Unlimited scans, XLSX + TXF + QuickBooks exports, backup/restore, all future Pro features |
| **Pro annual** | **$39.99/yr** with **7-day free trial** — the highlighted default | same |
| **Pro lifetime** | **$99.99** one-time | same, forever |

RevenueCat identifiers (create in dashboard + App Store Connect):
- Entitlement: `pro`
- Offering: `default`
- Products: `receiptsnap_pro_monthly` ($6.99), `receiptsnap_pro_annual` ($39.99, 7-day trial), `receiptsnap_pro_lifetime` ($99.99 non-consumable)
- Subscription group: `ReceiptSnap Pro`

### 3.2 Why these numbers (benchmark-driven)

- RevenueCat 2026 (115K apps): median download→paid 2.0% global / **2.6% North America**; **higher-priced apps out-convert lower-priced** (D35 2.7% vs 1.5%) with ~6x the LTV per payer. $2.99 pricing signals low value and halves LTV. The data window that maximizes revenue is **$4.99–9.99/mo** → $6.99 sits mid-window while undercutting Veryfi/Keeper by 65–90%.
- Median annual price ≈ **3.5x monthly** across the industry; $39.99 = 5.7x our monthly (43% discount vs 12 months) — slightly rich vs norm, justified because annual is where we want everyone (annual Year-1 realized retention is **44% vs 17% monthly**; yearly-dominant apps earn ~1.6x revenue per install).
- Trial→paid median in North America is **34.2%**; trials on the annual SKU are the standard business-app funnel.
- Lifetime at ~2.5x annual follows RevenueCat guidance ("price high to limit cannibalization"; observed range 2–12x). With zero server COGS, lifetime is nearly pure margin and *reinforces* the privacy brand ("pay once, own it — no account, no rent").
- Free tier at 10 scans/mo: freemium converts 2.1% vs hard-paywall 10.7%, but a scanner needs to prove OCR quality before asking for money, and ratings volume (social proof at tax season) comes from free users. 10/month lets a hobbyist live free (they were never buyers) while any real business hits the wall in week one — the conversion moment lands exactly when the user has seen the product work 10 times.
- **App Store Small Business Program:** 15% commission confirmed current (≤$1M/yr proceeds). Net per annual sub ≈ **$33.99**.

### 3.3 Revenue model (conservative → good cases)

Assumptions: $39.99 annual dominant, 15% commission, NA benchmarks.

| Scenario | Installs/yr | Free→paid | Payers | Year-1 net revenue |
|---|---|---|---|---|
| Soft launch year | 20,000 | 2.0% | 400 | ~$13,600 |
| Benchmark NA conversion | 50,000 | 2.6% | 1,300 | ~$44,200 |
| Privacy positioning converts (top quartile) | 100,000 | 5.6% | 5,600 | ~$190,400 |

Renewals compound: annual realized retention ~44% means year 2 starts with ~half of year-1 payers pre-loaded. These numbers exclude lifetime purchases (pure upside) and assume zero paid acquisition.

---

## 4. The ads question — analyzed and answered

You asked whether ads targeted from OCR text make sense. **Technically: yes, trivially** — `react-native-google-mobile-ads` accepts per-request `keywords[]`. **Commercially and legally: it is the single worst thing this app could do.** Verdict: **no ads, and specifically never OCR-derived targeting.**

1. **The economics fail on their own.** Receipt scanners are low-frequency utilities (69% of finance-app users open their app ≤5x/month). At realistic US iOS eCPMs (banner ~$0.30 blended, interstitial ~$7 at utility-category ATT opt-in rates), a retained free user generates **$0.25–0.70/year**. The subscription funnel already implies **$0.68–1.70 per free user** at median conversion — ads earn 2–5x less while damaging the ratings and retention that drive organic install volume.
2. **The privacy label flips.** Apple's rules: anything *derived* from on-device data and sent off-device must be declared. OCR keywords = "Purchases — used for Third-Party Advertising" on the nutrition label, plus the AdMob SDK's own privacy manifest declares identifiers/IP/usage data. The label goes from **"Data Not Collected"** (our headline asset) to a multi-category advertising disclosure.
3. **ATT contradiction.** Monetizing personalized ads requires showing "Allow ReceiptSnap to track your activity across other companies' apps?" — in an app whose subtitle is "your data never leaves your phone."
4. **Regulatory exposure is real.** FTC's Avast settlement ($16.5M, payments began Dec 2025) is precisely this fact pattern: privacy-promising software transmitting derived user data. Receipt contents include pharmacy items (health data), alcohol, and embedded PII — sensitive-category landmines under Google's own publisher policies, and CPRA "sharing" triggering Do-Not-Share obligations.
5. **Category precedent is one-directional.** Every premium competitor sells privacy and subscriptions. The ad-monetized finance-tool archetype (Mint) died of the incentive conflict. The apps that DO monetize receipt data (Fetch, Receipt Hog) pay users for it explicitly — the honest inverse of our brand.

**Max-profit substitute for ad revenue:** the $99.99 lifetime SKU (monetizes ad-averse privacy buyers), plus an annual-trial paywall shown at the 10-scan wall — both compound the brand instead of burning it.

---

## 5. Go-to-market strategy

### 5.1 Positioning
- **Name:** ReceiptSnap — Receipt Scanner
- **Subtitle:** "Private, on-device tax scans" (30 chars ✓)
- **One-liner:** *The receipt scanner that never sees your receipts. On-device OCR files every receipt to the right Schedule C line — no account, no cloud, no subscription required to start.*
- **Hero proof point:** side-by-side App Privacy labels — ReceiptSnap "Data Not Collected" vs Keeper/QuickBooks/Wave advertising disclosures. Use it in screenshot 2 of the listing.

### 5.2 Channel plan (zero → low budget, in order)
1. **ASO (the main engine).** 70% of App Store visitors use search. Target: "receipt scanner" (primary), "receipt tracker", "expense tracker self employed", "schedule c", "1099 taxes", "mileage" (later feature). Ship keyword-optimized metadata now; iterate monthly through fall (Intuit's own off-season playbook).
3. **Ratings flywheel:** SKStoreReviewController prompt after 3rd successful scan (the aha moment). Goal: 50+ ratings at 4.7+ before January.
2. **Reddit (value-first).** r/smallbusiness (weekly promo threads only), r/tax, r/freelance, r/Bookkeeping — answer receipt/deduction questions with genuinely useful content; app mention per subreddit rules. One good "I built a receipt scanner that never uploads your data" post in a promo thread historically outperforms ads at $0.
4. **TikTok/Reels tax creators (Dec–Feb).** Nano/micro CPA-credible creators run $50–800/post. Brief: "the only receipt app that can't leak your data." Avoid "tax hack" accounts (audit-risk backlash).
5. **Product Hunt** launch in January ("privacy-first receipt scanner for tax season") — PH skews web/desktop, so treat as press/SEO, not installs.
6. **Apple Search Ads (surgical, Jan–Apr only).** Business-category CPI benchmarks ~$2.49–2.90. At median conversion that's ~$96–112 CAC per payer — only defensible on exact-match high-intent terms ("receipt scanner taxes", "schedule c expenses") against the $39.99 annual with 44% retention. Cap at $10–20/day, kill anything above $60 CAC. April is a cheap acquisition window (costs peak Sept–Dec).
7. **Press angle:** "Solo developer ships receipt scanner that Apple confirms collects zero data" — pitch to 9to5Mac/TechCrunch privacy beat + tax-season app roundups (December, when roundups get written).

### 5.3 Seasonality calendar
- **Sep–Oct:** App Store launch (v1.0). Soft-launch goals: crash-free ≥ 99.5%, 50+ ratings, OCR accuracy iteration via diagnostic reports.
- **Nov:** Feature additions via OTA updates (no new build needed for JS): mileage log, year-end summary polish. Enroll Small Business Program (do it at launch).
- **Early–mid Dec:** tax-season metadata/screenshots submitted; creator campaign booked; PH scheduled.
- **Jan 1 – Apr 15:** the revenue window (Keeper runs ~5x install volume late January; tax apps collapse −98% after April 15). All spend and pushes concentrate here.
- **Apr–Aug 2027:** retention features (quarterly estimated-tax reminders — gives the app a reason to exist off-season), Android evaluation.

### 5.4 Pricing experiments (after launch, via RevenueCat)
- A/B the paywall (RevenueCat Paywalls, remote-configurable without app updates): $39.99 vs $49.99 annual; trial 7 vs 14 days (longer trials convert better: 42.5% at 17–32 days).
- January "tax season" offer: first year $29.99 (25% intro offer) — intro offers don't reprice existing subs.
- If conversion > 4% sustained: raise annual to $49.99 (the data says premium pricing out-converts).

---

## 6. Technical/monetization stack decisions (verified compatible)

| Decision | Choice | Why |
|---|---|---|
| Expo SDK | **55** (RN 0.83, New Architecture, min iOS 15.1) | Matches VaultVision exactly (per your Fastio docs: SDK 55 migration completed May 2026) — same toolchain, same known-good EAS flow. Still fully supported (Expo supports 54–57). |
| OCR | **expo-text-extractor 2.0** (Apple Vision `VNRecognizeTextRequest` on iOS) | Native Apple OCR beats ML Kit on dense receipt text, adds zero binary weight, Expo Modules API = New-Arch safe, no config plugin, updated post-SDK-55. Returns ordered text lines — exactly what classifier.js consumes. |
| Purchases | **react-native-purchases 10.6 + purchases-ui** (RevenueCat) | Free to $2,500/mo tracked revenue then 1%; no config plugin; paywalls remote-configurable (price tests without builds); products fetched at runtime so pricing changes never require native builds. |
| Ads | **None** | §4. |
| XLSX export | **SheetJS CE 0.20.3** (CDN tarball) | exceljs is unmaintained and hangs RN at splash (documented). SheetJS is pure JS, Hermes-safe, official RN recipe. CSV/TXF/QBO reuse `exporters.js` verbatim. |
| DB / images | expo-sqlite + expo-file-system | Local-only by design. |
| OTA | **expo-updates from build #1** | JS-only fixes ship over the air — protects your EAS build budget (free tier: 15 iOS builds/mo; OTA free tier: 1,000 MAU). |
| Version stamp | Settings row + Summary footer: `v1.0.0 (build 1) · js r1` | Same verification convention as the PWA (v5.5). |

### VaultVision details referenced (from your Fastio workspace)
Extracted from CLAUDE.MD / T-015.5A / T-015.5-DEV-BUILD-MIGRATION / ARCHITECTURE.MD summaries: Expo SDK 55 + New Architecture (migrated from 54), expo-dev-client via EAS with device-UDID registration and physical-iPhone testing, gesture-handler/reanimated, free-tier watermark pattern, Maestro E2E. **Note:** I could not pull raw file bytes from this cloud sandbox (Fastio's download endpoint is blocked by both egress proxies here, and the workspace AI Q&A endpoint returned "requires an upgraded plan"), so exact RevenueCat product IDs from VaultVision weren't retrievable — ARCHITECTURE.MD's summary actually says VaultVision uses **Stripe** for subscriptions, so ReceiptSnap's RevenueCat naming above is a fresh, convention-clean scheme rather than a copy. Everything RevenueCat-related lives in JS/dashboard config, so nothing about it risks the one dev build.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Micro-apps or an incumbent copies the on-device claim | Speed + ratings moat; Schedule C depth is months of parser work they don't have |
| Apple Vision OCR quality on crumpled receipts | Same correction-memory system as PWA; diagnostic long-press pipeline for fast parser iteration via OTA |
| Seasonal revenue cliff after April 15 | Quarterly estimated-tax reminders, mileage log, year-round expense features |
| Trial abuse / refunds | Annual trial requires payment method; RevenueCat handles receipt validation |
| App Review challenges the "no data" claim | It's true — no analytics SDK in v1; App Review notes explain on-device OCR |
| EAS build budget | One dev build (all native deps locked in), OTA for everything JS; production build only when store-ready |

---

*Research appendix: competitor prices from apps.apple.com US listings and official pricing pages (Aug 1, 2026); IRS SOI TY2022 sole-proprietorship report; IRS Pub 6961; Census nonemployer statistics 2023; RevenueCat State of Subscription Apps 2026 (+ Utilities/Business cuts); Adapty State of In-App Subscriptions; Airbridge 2026 pricing benchmarks; Apple Small Business Program page; Apple User Privacy and Data Use + App Privacy Details; Google AdMob publisher policies + data disclosure; FTC Avast settlement releases; Appodeal/Mistplay eCPM reports; Adjust ATT benchmarks; UXCam engagement benchmarks; Sensor Tower tax-category quarterly download reports (2023–2025); Appfigures TurboTax teardown; SplitMetrics/AppTweak Apple Ads benchmarks; Expo SDK 55–57 changelogs; docs.expo.dev; RevenueCat docs + pricing; SheetJS RN demo docs; npm registry.*
