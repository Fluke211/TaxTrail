#!/usr/bin/env bash
# ============================================================================
# ReceiptSnap Mobile — self-building installer (Expo SDK 55, iOS)
# Reconstructs the complete, verified project with no file transfer needed:
#   - scaffolds the official SDK 55 TypeScript template
#   - extracts classifier.js + exporters.js from the deployed PWA (v5.5)
#   - writes all app source (verified: 10/10 tests, tsc clean, prebuild clean)
#   - regenerates the app icons from code (no binaries shipped)
# Usage:  bash setup-receiptsnap-mobile.sh     (run from anywhere; builds in ~)
# ============================================================================
set -euo pipefail

APP_DIR="$HOME/receiptsnap-mobile"
PWA_URL="https://raw.githubusercontent.com/Fluke211/receipt-snap/main/index.html"

echo "==> [1/7] Checking prerequisites"
command -v node >/dev/null || { echo "node is required"; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
node -e 'const v=+process.versions.node.split(".")[0]; if (v<20) { console.error("Need Node >= 20, have " + process.versions.node); process.exit(1);}'
echo "    node $(node --version) / npm $(npm --version) OK"

echo "==> [2/7] Scaffolding Expo SDK 55 template"
rm -rf "$APP_DIR"
cd "$HOME"
printf 'y\ny\ny\n' | npx --yes create-expo-app@latest receiptsnap-mobile --template blank-typescript@sdk-55 --no-install
cd "$APP_DIR"
mkdir -p src/lib src/screens __tests__

echo "==> [3/7] Installing dependencies (pinned to SDK 55 known-good set)"
npm install --no-audit --no-fund
npm install --no-audit --no-fund \
  'expo-dev-client@~55.0.37' 'expo-updates@~55.0.26' 'expo-image-picker@~55.0.22' \
  'expo-image-manipulator@~55.0.19' 'expo-sqlite@~55.0.18' 'expo-file-system@~55.0.24' \
  'expo-sharing@~55.0.22' '@react-native-async-storage/async-storage@2.2.0' \
  'react-native-safe-area-context@~5.6.2' 'expo-clipboard@~55.0.15' 'expo-store-review@~55.0.16' \
  'react-native-purchases@10.6.0' 'react-native-purchases-ui@10.6.0' \
  'expo-text-extractor@2.0.0' 'xlsx@0.18.5'
npm pkg set name="receiptsnap-mobile" scripts.test:unit="node __tests__/classifier.test.js" > /dev/null

echo "==> [4/7] Extracting classifier + exporters from the deployed PWA (v5.5)"
curl -fsSL "$PWA_URL" -o /tmp/receiptsnap-pwa.html
python3 - <<'RS_PYEOF'
import re
html = open('/tmp/receiptsnap-pwa.html', encoding='utf-8').read()
blocks = re.findall(r'<script>\n(/\*\n \* ReceiptSnap.*?)\n</script>', html, re.S)
assert len(blocks) >= 2, f"expected 2 inlined ReceiptSnap modules, found {len(blocks)}"
classifier = next(b for b in blocks if 'receipt text parsing' in b.split('\n')[1])
exporters = next(b for b in blocks if 'export builders' in b.split('\n')[1])
assert 'parseReceipt' in classifier and '\\bfsa\\b' in classifier, 'classifier extraction sanity failed'
assert 'buildCpaCSV' in exporters and 'buildTXF' in exporters, 'exporters extraction sanity failed'
open('src/lib/classifier.js', 'w', encoding='utf-8').write(classifier + '\n')
open('src/lib/exporters.js', 'w', encoding='utf-8').write(exporters + '\n')
print(f"    classifier.js {len(classifier)}B / exporters.js {len(exporters)}B extracted")
RS_PYEOF

echo "==> [5/7] Writing app source"

cat > app.json <<'RS_EOF'
{
  "expo": {
    "name": "ReceiptSnap",
    "slug": "receiptsnap",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "newArchEnabled": true,
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#0f172a"
    },
    "ios": {
      "bundleIdentifier": "com.vaultvision.receiptsnap",
      "buildNumber": "1",
      "supportsTablet": false,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "package": "com.vaultvision.receiptsnap",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      },
      "predictiveBackGestureEnabled": false
    },
    "plugins": [
      [
        "expo-image-picker",
        {
          "cameraPermission": "ReceiptSnap uses the camera to photograph receipts. Photos are processed entirely on this device and never uploaded.",
          "photosPermission": "ReceiptSnap can import receipt photos from your library. Photos are processed entirely on this device and never uploaded."
        }
      ],
      "expo-sqlite"
    ]
  }
}
RS_EOF

cat > eas.json <<'RS_EOF'
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  },
  "submit": {
    "production": {}
  }
}
RS_EOF

cat > src/lib/theme.ts <<'RS_EOF'
// ReceiptSnap dark theme — same tokens as the PWA (web/index.html :root).
export const T = {
  accent: '#4f7cff',
  accentSoft: 'rgba(79,124,255,0.16)',
  accentLine: 'rgba(79,124,255,0.40)',
  bg: '#0a0e14',
  bg2: '#0d1420',
  card: '#121a26',
  card2: '#182333',
  line: 'rgba(255,255,255,0.07)',
  text: '#e8edf5',
  muted: '#8a97ab',
  muted2: '#5b6678',
  danger: '#ff6b6b',
  warn: '#f0b429',
  good: '#35c88a',
  radius: 14,
  radiusLg: 20,
};
RS_EOF

cat > src/lib/config.ts <<'RS_EOF'
// App configuration — every value here is JS-only, so it can be changed later
// via an EAS OTA update without a new native build.

// RevenueCat PUBLIC Apple API key. Paste yours from
// app.revenuecat.com → Project → API keys (starts with "appl_").
// Leaving the placeholder keeps the app fully functional in free mode:
// purchases are simply disabled until the key is set.
export const REVENUECAT_APPLE_API_KEY = 'appl_REPLACE_ME';

// Entitlement / product identifiers (must match the RevenueCat dashboard).
export const ENTITLEMENT_PRO = 'pro';

// Free-tier limit: scans per calendar month.
export const FREE_SCANS_PER_MONTH = 10;

// Display-only fallback pricing (real prices always come from StoreKit at runtime).
export const DISPLAY_PRICES = {
  monthly: '$6.99/mo',
  annual: '$39.99/yr',
  lifetime: '$99.99 once',
};
RS_EOF

cat > src/lib/version.ts <<'RS_EOF'
// Version stamp — shown in the Summary footer, same convention as the PWA.
// APP_VERSION/BUILD change only with a native build; JS_REVISION bumps with
// every OTA (EAS Update) push so Tyler can verify which JS he's running.
export const APP_VERSION = '1.0.0';
export const APP_BUILD = 1;
export const JS_REVISION = 1;

export function versionStamp(): string {
  return `ReceiptSnap v${APP_VERSION} (build ${APP_BUILD}) · js r${JS_REVISION}`;
}
RS_EOF

cat > src/lib/classifier.d.ts <<'RS_EOF'
export interface ParsedCategory {
  name: string;
  scheduleC: string;
  group: string;
}
export interface LineItem {
  desc: string;
  amount: number;
}
export interface ParsedReceipt {
  items: LineItem[];
  taxRate: number | null;
  taxRatePrinted: number | null;
  taxTotal: number | null;
  subtotal: number | null;
  city: string | null;
  merchant: string | null;
  total: number | null;
  date: string | null;
  category: string;
  scheduleC: string;
  confidence: 'high' | 'medium' | 'low';
  matchedKeywords: string[];
}
export function parseReceipt(rawText: string): ParsedReceipt;
export function classify(text: string, merchant: string | null): { name: string; scheduleC: string; confidence: string; hits: string[] };
export function extractLineItems(lines: string[]): LineItem[];
export function extractTaxInfo(lines: string[]): { subtotal: number | null; tax: number | null; rate: number | null; printedRate: number | null };
export function extractCity(lines: string[]): string | null;
export function diceSimilarity(a: string, b: string): number;
export function taxFormOf(cat: string): string;
export function formSortKey(cat: string, scheduleC: string): [number, number];
export const TXF_CODES: Record<string, number | null>;
export const CATEGORIES: ParsedCategory[];
export const GROUP_ORDER: string[];
RS_EOF

cat > src/lib/exporters.d.ts <<'RS_EOF'
export interface ExportRow {
  date: string;
  merchant: string;
  amount: number;
  category: string;
  sc: string;
  business: boolean;
  notes: string;
  rid: string;
  split: string;
  taxPortion: number | null;
}
export function buildCpaCSV(rows: ExportRow[]): string;
export function buildTXF(rows: ExportRow[], now?: Date): { content: string; skipped: number };
export function buildQBO(rows: ExportRow[]): string;
export function buildWorkbook(ExcelJS: unknown, rows: ExportRow[], year: string): unknown;
RS_EOF

cat > src/lib/db.ts <<'RS_EOF'
// SQLite persistence. All data stays on-device: receipts rows + JPEG files
// under the app's documents directory.
import * as SQLite from 'expo-sqlite';

export interface Allocation {
  category: string;
  scheduleC: string;
  amount: number;
  base?: number;
  tax?: number;
}

export interface Receipt {
  id?: number;
  createdAt: string;
  merchant: string;
  date: string; // ISO yyyy-mm-dd
  total: number;
  category: string;
  scheduleC: string;
  notes: string;
  salesTax: number | null;
  taxRate: number | null;
  allocations: Allocation[];
  confidence: string;
  ocrText: string;
  imagePath: string | null;
  thumbPath: string | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('receiptsnap.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS receipts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          createdAt TEXT NOT NULL,
          merchant TEXT NOT NULL,
          date TEXT NOT NULL,
          total REAL NOT NULL,
          category TEXT NOT NULL,
          scheduleC TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          salesTax REAL,
          taxRate REAL,
          allocations TEXT NOT NULL DEFAULT '[]',
          confidence TEXT NOT NULL DEFAULT 'low',
          ocrText TEXT NOT NULL DEFAULT '',
          imagePath TEXT,
          thumbPath TEXT
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

function rowToReceipt(r: any): Receipt {
  let allocations: Allocation[] = [];
  try { allocations = JSON.parse(r.allocations || '[]'); } catch {}
  return { ...r, allocations, salesTax: r.salesTax ?? null, taxRate: r.taxRate ?? null };
}

export async function addReceipt(r: Receipt): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO receipts (createdAt, merchant, date, total, category, scheduleC, notes, salesTax, taxRate, allocations, confidence, ocrText, imagePath, thumbPath)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.createdAt, r.merchant, r.date, r.total, r.category, r.scheduleC, r.notes,
    r.salesTax, r.taxRate, JSON.stringify(r.allocations || []), r.confidence,
    r.ocrText, r.imagePath, r.thumbPath
  );
  return res.lastInsertRowId;
}

export async function updateReceipt(r: Receipt): Promise<void> {
  if (r.id == null) throw new Error('updateReceipt: missing id');
  const db = await getDb();
  await db.runAsync(
    `UPDATE receipts SET merchant=?, date=?, total=?, category=?, scheduleC=?, notes=?, salesTax=?, taxRate=?, allocations=? WHERE id=?`,
    r.merchant, r.date, r.total, r.category, r.scheduleC, r.notes,
    r.salesTax, r.taxRate, JSON.stringify(r.allocations || []), r.id
  );
}

export async function deleteReceipt(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM receipts WHERE id=?', id);
}

export async function allReceipts(): Promise<Receipt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM receipts ORDER BY date DESC, id DESC');
  return rows.map(rowToReceipt);
}

// Scans this calendar month — the free-tier gate.
export async function countThisMonth(): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM receipts WHERE substr(createdAt, 1, 7) = ?", prefix
  );
  return row?.n ?? 0;
}
RS_EOF

cat > src/lib/memory.ts <<'RS_EOF'
// Merchant + tax-rate memory, ported from the PWA (localStorage → AsyncStorage).
// Merchant memory: fuzzy fingerprint matching (character-bigram Dice similarity)
// with a digit gate so same-street stores don't cross-match.
import AsyncStorage from '@react-native-async-storage/async-storage';
const C = require('./classifier.js');

const MERCHANT_KEY = 'rs.merchantMemory.v1';
const TAX_KEY = 'rs.taxMemory.v1';

interface MerchantEntry { fp: string[]; name: string }
interface TaxMemory { cities: Record<string, number>; last: number | null }

// City/zip-only lines are excluded from fingerprints (they match across stores).
const CITYISH = /^[A-Za-z .'-]{3,24}[,.]?\s+[A-Z]{2}(\s+\d{5})?\s*$/;

function fingerprint(ocrText: string): string[] {
  return (ocrText || '')
    .split('\n').map((l) => l.trim().toLowerCase())
    .filter((l) => l.length >= 6 && l.length <= 40 && !CITYISH.test(l))
    .slice(0, 8);
}

function digitsOf(s: string): string {
  const m = s.match(/\d{2,}/);
  return m ? m[0] : '';
}

async function loadMerchants(): Promise<MerchantEntry[]> {
  try { return JSON.parse((await AsyncStorage.getItem(MERCHANT_KEY)) || '[]'); } catch { return []; }
}

export async function memLookup(ocrText: string): Promise<string | null> {
  const entries = await loadMerchants();
  const fp = fingerprint(ocrText);
  let best: { name: string; score: number } | null = null;
  for (const e of entries) {
    let score = 0, pairs = 0;
    for (const a of fp) {
      for (const b of e.fp) {
        const s = C.diceSimilarity(a, b);
        if (s >= 0.55) {
          // digit gate: street numbers must agree when both lines carry one
          const da = digitsOf(a), db = digitsOf(b);
          if (da && db && da !== db) continue;
          score += s; pairs++;
        }
      }
    }
    if (pairs >= 2 && (!best || score > best.score)) best = { name: e.name, score };
  }
  return best ? best.name : null;
}

export async function memLearn(ocrText: string, name: string): Promise<boolean> {
  if (!name || name === 'Unknown merchant') return false;
  const existing = await memLookup(ocrText);
  if (existing === name) return false;
  const entries = await loadMerchants();
  const fp = fingerprint(ocrText);
  if (!fp.length) return false;
  const filtered = entries.filter((e) => e.name !== name);
  filtered.push({ fp, name });
  await AsyncStorage.setItem(MERCHANT_KEY, JSON.stringify(filtered.slice(-40)));
  return true;
}

async function loadTax(): Promise<TaxMemory> {
  try { return JSON.parse((await AsyncStorage.getItem(TAX_KEY)) || '{"cities":{},"last":null}'); } catch { return { cities: {}, last: null }; }
}

export async function taxMemLookup(city: string | null): Promise<{ rate: number; fromCity: boolean } | null> {
  const mem = await loadTax();
  if (city && mem.cities[city] != null) return { rate: mem.cities[city], fromCity: true };
  if (mem.last != null) return { rate: mem.last, fromCity: false };
  return null;
}

export async function taxMemLearn(city: string | null, rate: number | null): Promise<void> {
  if (!rate || rate <= 0 || rate > 0.25) return;
  const mem = await loadTax();
  if (city) mem.cities[city] = rate;
  mem.last = rate;
  await AsyncStorage.setItem(TAX_KEY, JSON.stringify(mem));
}
RS_EOF

cat > src/lib/ocr.ts <<'RS_EOF'
// On-device OCR pipeline: downscale the photo, run Apple Vision text recognition
// (via expo-text-extractor), and persist the processed JPEG + thumbnail into the
// app's documents directory. Nothing ever leaves the device.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { extractTextFromImage } from 'expo-text-extractor';
import * as FileSystem from 'expo-file-system/legacy';

const DIR = `${FileSystem.documentDirectory}receipts/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

async function resizeTo(uri: string, width: number, compress: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ compress, format: SaveFormat.JPEG });
  return result.uri;
}

export interface OcrResult {
  text: string;
  imagePath: string;
  thumbPath: string;
}

export async function processReceiptPhoto(sourceUri: string): Promise<OcrResult> {
  await ensureDir();
  const stamp = Date.now();

  // Working copy: 1600px wide is the OCR sweet spot (detail vs speed).
  const ocrUri = await resizeTo(sourceUri, 1600, 0.92);

  // Apple Vision returns recognized strings in reading order.
  const lines = await extractTextFromImage(ocrUri);
  const text = (lines || []).join('\n');

  // Stored record: 1200px JPEG + 200px thumbnail.
  const storedUri = await resizeTo(sourceUri, 1200, 0.85);
  const thumbUri = await resizeTo(sourceUri, 200, 0.7);

  const imagePath = `${DIR}${stamp}.jpg`;
  const thumbPath = `${DIR}${stamp}-thumb.jpg`;
  await FileSystem.copyAsync({ from: storedUri, to: imagePath });
  await FileSystem.copyAsync({ from: thumbUri, to: thumbPath });

  return { text, imagePath, thumbPath };
}

export async function deleteReceiptFiles(r: { imagePath: string | null; thumbPath: string | null }): Promise<void> {
  for (const p of [r.imagePath, r.thumbPath]) {
    if (p) { try { await FileSystem.deleteAsync(p, { idempotent: true }); } catch {} }
  }
}
RS_EOF

cat > src/lib/purchases.ts <<'RS_EOF'
// RevenueCat wiring. Everything here is defensive: with the placeholder API key
// (or offline), the app runs in free mode and purchase UI is unavailable —
// no crashes, no blocked flows.
import { Alert } from 'react-native';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { ENTITLEMENT_PRO, REVENUECAT_APPLE_API_KEY } from './config';

let configured = false;

export function initPurchases(): void {
  if (configured) return;
  if (!REVENUECAT_APPLE_API_KEY || REVENUECAT_APPLE_API_KEY.includes('REPLACE_ME')) return;
  try {
    Purchases.configure({ apiKey: REVENUECAT_APPLE_API_KEY });
    configured = true;
  } catch (e) {
    console.warn('RevenueCat configure failed', e);
  }
}

export async function isPro(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_PRO] != null;
  } catch {
    return false;
  }
}

// Show the RevenueCat remote-configured paywall; falls back to a plain package
// chooser if no paywall template is configured in the dashboard yet.
export async function presentPaywall(): Promise<boolean> {
  if (!configured) {
    Alert.alert(
      'Purchases not configured',
      'Set REVENUECAT_APPLE_API_KEY in src/lib/config.ts to enable ReceiptSnap Pro.'
    );
    return false;
  }
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_PRO,
    });
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED ||
      result === PAYWALL_RESULT.NOT_PRESENTED; // NOT_PRESENTED = already entitled
  } catch {
    // No paywall configured in the dashboard — plain fallback purchase flow.
    try {
      const offerings = await Purchases.getOfferings();
      const pkgs = offerings.current?.availablePackages ?? [];
      if (!pkgs.length) {
        Alert.alert('Store unavailable', 'Could not load products. Check the RevenueCat offering configuration.');
        return false;
      }
      return await new Promise<boolean>((resolve) => {
        Alert.alert(
          'ReceiptSnap Pro',
          'Unlimited scans + all export formats.',
          [
            ...pkgs.map((p) => ({
              text: `${p.product.title} — ${p.product.priceString}`,
              onPress: async () => {
                try {
                  const { customerInfo } = await Purchases.purchasePackage(p);
                  resolve(customerInfo.entitlements.active[ENTITLEMENT_PRO] != null);
                } catch { resolve(false); }
              },
            })),
            { text: 'Restore purchases', onPress: async () => {
              try {
                const info = await Purchases.restorePurchases();
                resolve(info.entitlements.active[ENTITLEMENT_PRO] != null);
              } catch { resolve(false); }
            } },
            { text: 'Not now', style: 'cancel' as const, onPress: () => resolve(false) },
          ]
        );
      });
    } catch (e) {
      console.warn('purchase flow failed', e);
      return false;
    }
  }
}
RS_EOF

cat > src/lib/rows.ts <<'RS_EOF'
// Export-row assembly — direct port of the PWA's exportRows()/allocationsOf()/
// isBusiness() so every export format produces byte-identical semantics.
import type { Receipt, Allocation } from './db';
import type { ExportRow } from './exporters';
const C = require('./classifier.js');

const SC_BY_NAME: Record<string, string> = {};
const GROUP_BY_NAME: Record<string, string> = {};
for (const c of C.CATEGORIES as { name: string; scheduleC: string; group: string }[]) {
  SC_BY_NAME[c.name] = c.scheduleC;
  GROUP_BY_NAME[c.name] = c.group;
}
export { SC_BY_NAME, GROUP_BY_NAME };

export function isBusiness(cat: string): boolean {
  return GROUP_BY_NAME[cat] !== 'Not Schedule C';
}

export function allocationsOf(r: Receipt): Allocation[] {
  if (r.allocations && r.allocations.length) return r.allocations;
  return [{ category: r.category, scheduleC: r.scheduleC || SC_BY_NAME[r.category] || '', amount: r.total || 0 }];
}

export function exportRows(filtered: Receipt[]): ExportRow[] {
  const rows: ExportRow[] = [];
  filtered
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .forEach((r) => {
      const allocs = allocationsOf(r);
      const tot = r.total || allocs.reduce((s, a) => s + (a.amount || 0), 0) || 1;
      allocs.forEach((a, i) => {
        rows.push({
          date: r.date || '',
          merchant: r.merchant || '',
          amount: a.amount || 0,
          category: a.category,
          sc: a.scheduleC || SC_BY_NAME[a.category] || '',
          business: isBusiness(a.category),
          notes: r.notes || '',
          rid: 'R' + r.id,
          split: allocs.length > 1 ? `${i + 1} of ${allocs.length}` : '',
          taxPortion: r.salesTax && r.salesTax > 0
            ? Math.round(r.salesTax * ((a.amount || 0) / tot) * 100) / 100
            : null,
        });
      });
    });
  return rows;
}
RS_EOF

cat > src/lib/xlsxExport.ts <<'RS_EOF'
// Real .xlsx via SheetJS (pure JS — Hermes-safe). Mirrors the PWA workbook's
// structure: Summary (grouped by IRS form) / Schedule C / Other Forms + Personal.
// (The PWA's ExcelJS data-bar formatting isn't supported by SheetJS CE; the
// numbers and organization are identical.)
import * as XLSX from 'xlsx';
import type { ExportRow } from './exporters';
const C = require('./classifier.js');

export function buildXlsxBase64(rows: ExportRow[], yearLabel: string): string {
  const wb = XLSX.utils.book_new();

  // ---- Summary: category totals grouped by tax form ----
  const byCat = new Map<string, { total: number; count: number; sc: string }>();
  for (const r of rows) {
    const e = byCat.get(r.category) || { total: 0, count: 0, sc: r.sc };
    e.total += r.amount; e.count += 1;
    byCat.set(r.category, e);
  }
  const cats = [...byCat.entries()].sort((a, b) => {
    const ka = C.formSortKey(a[0], a[1].sc), kb = C.formSortKey(b[0], b[1].sc);
    return ka[0] - kb[0] || ka[1] - kb[1] || b[1].total - a[1].total;
  });

  const summary: (string | number)[][] = [
    [`ReceiptSnap — Tax Year ${yearLabel}`], [],
    ['Category', 'Tax Form', 'Entries', 'Total'],
  ];
  let currentForm = '';
  for (const [name, e] of cats) {
    const form = C.taxFormOf(name);
    if (form !== currentForm) {
      currentForm = form;
      summary.push([]);
      summary.push([form.toUpperCase()]);
    }
    summary.push([name, e.sc, e.count, Math.round(e.total * 100) / 100]);
  }
  // Sales tax paid section (Schedule A line 5a support)
  const stBiz = rows.filter(r => r.business && r.taxPortion).reduce((s, r) => s + (r.taxPortion || 0), 0);
  const stPersonal = rows.filter(r => !r.business && r.taxPortion).reduce((s, r) => s + (r.taxPortion || 0), 0);
  summary.push([], ['SALES TAX PAID'],
    ['On business purchases', '', '', Math.round(stBiz * 100) / 100],
    ['On personal purchases (Schedule A line 5a)', '', '', Math.round(stPersonal * 100) / 100]);
  summary.push([], ['Import tip: FreeTaxUSA/TurboTax — enter each Schedule C line total directly.']);

  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 46 }, { wch: 9 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, `Summary ${yearLabel}`);

  // ---- Transaction tabs ----
  const header = ['Date', 'Merchant', 'Amount', 'Tax Form', 'Category', 'Form Line', 'Sales Tax Portion', 'Notes', 'Receipt ID', 'Split Part'];
  const toRow = (r: ExportRow) => [r.date, r.merchant, r.amount, C.taxFormOf(r.category), r.category, r.sc, r.taxPortion ?? '', r.notes, r.rid, r.split];

  const schedC = rows.filter(r => C.taxFormOf(r.category) === 'Schedule C');
  const other = rows.filter(r => C.taxFormOf(r.category) !== 'Schedule C');

  const wsC = XLSX.utils.aoa_to_sheet([header, ...schedC.map(toRow)]);
  wsC['!cols'] = header.map((h, i) => ({ wch: i === 1 || i === 4 || i === 5 ? 30 : 13 }));
  wsC['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: schedC.length, c: header.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, wsC, 'Schedule C');

  const wsO = XLSX.utils.aoa_to_sheet([header, ...other.map(toRow)]);
  wsO['!cols'] = wsC['!cols'];
  wsO['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: other.length, c: header.length - 1 } }) };
  XLSX.utils.book_append_sheet(wb, wsO, 'Other Forms + Personal');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}
RS_EOF

cat > src/lib/exportShare.ts <<'RS_EOF'
// Export builders → file in the cache dir → iOS share sheet.
// CSV/TXF/QBO come verbatim from exporters.js (shared with the PWA + tests).
// XLSX is built with SheetJS (pure JS, Hermes-safe) — see xlsxExport.ts.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { Receipt } from './db';
import { exportRows } from './rows';
import { buildXlsxBase64 } from './xlsxExport';
const X = require('./exporters.js');

async function shareText(filename: string, content: string, mimeType: string): Promise<void> {
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType, dialogTitle: filename });
}

async function shareBase64(filename: string, b64: string, mimeType: string): Promise<void> {
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, b64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, { mimeType, dialogTitle: filename });
}

const year = () => String(new Date().getFullYear());

export async function exportCSV(receipts: Receipt[]): Promise<void> {
  const csv: string = X.buildCpaCSV(exportRows(receipts));
  await shareText(`receiptsnap-${year()}.csv`, csv, 'text/csv');
}

export async function exportTXF(receipts: Receipt[]): Promise<void> {
  const txf = X.buildTXF(exportRows(receipts), new Date());
  await shareText(`receiptsnap-${year()}.txf`, txf.content, 'application/octet-stream');
}

export async function exportQBO(receipts: Receipt[]): Promise<void> {
  const qbo: string = X.buildQBO(exportRows(receipts));
  await shareText(`receiptsnap-quickbooks-${year()}.csv`, qbo, 'text/csv');
}

export async function exportXLSX(receipts: Receipt[]): Promise<void> {
  const b64 = buildXlsxBase64(exportRows(receipts), year());
  await shareBase64(
    `receiptsnap-${year()}.xlsx`, b64,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

// Full JSON backup (same v2 schema family as the PWA backup).
export async function exportBackup(receipts: Receipt[]): Promise<void> {
  const payload = JSON.stringify({ app: 'ReceiptSnap', version: 2, exportedAt: new Date().toISOString(), receipts }, null, 1);
  await shareText(`receiptsnap-backup-${new Date().toISOString().slice(0, 10)}.json`, payload, 'application/json');
}
RS_EOF

cat > src/screens/CaptureScreen.tsx <<'RS_EOF'
// Capture flow: hero → camera/library → OCR → review form with the photo pinned
// at the top (scan controls hidden until Save or Discard — same UX as PWA v5.5).
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import * as StoreReview from 'expo-store-review';
import { T } from '../lib/theme';
import { addReceipt, countThisMonth, type Allocation } from '../lib/db';
import { processReceiptPhoto } from '../lib/ocr';
import { memLookup, memLearn, taxMemLookup, taxMemLearn } from '../lib/memory';
import { isPro, presentPaywall } from '../lib/purchases';
import { FREE_SCANS_PER_MONTH } from '../lib/config';
import { SC_BY_NAME } from '../lib/rows';
const C = require('../lib/classifier.js');

const CATEGORY_NAMES: string[] = (C.CATEGORIES as { name: string }[]).map((c) => c.name);

interface Pending {
  imagePath: string;
  thumbPath: string;
  ocrText: string;
  merchant: string;
  date: string;
  total: string;
  salesTax: string;
  taxRate: number | null;
  rateSource: string;
  category: string;
  confidence: string;
  merchantRemembered: boolean;
  city: string | null;
}

export default function CaptureScreen({ onSaved }: { onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notes, setNotes] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [showCats, setShowCats] = useState(false);
  const [allocs, setAllocs] = useState<Allocation[]>([]);
  const [splitCat, setSplitCat] = useState('Personal (non-deductible)');
  const [splitAmt, setSplitAmt] = useState('');
  const [splitTax, setSplitTax] = useState(true);
  const [showSplits, setShowSplits] = useState(false);
  const [showSplitCats, setShowSplitCats] = useState(false);

  const startScan = useCallback(async (fromLibrary: boolean) => {
    // Free-tier gate before the camera opens
    if (!(await isPro())) {
      const n = await countThisMonth();
      if (n >= FREE_SCANS_PER_MONTH) {
        const unlocked = await presentPaywall();
        if (!unlocked) return;
      }
    }
    const perm = fromLibrary
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'ReceiptSnap needs access to scan receipts. Everything stays on this device.');
      return;
    }
    const result = fromLibrary
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })
      : await ImagePicker.launchCameraAsync({ quality: 1 });
    if (result.canceled || !result.assets?.length) return;

    setBusy(true);
    try {
      const { text, imagePath, thumbPath } = await processReceiptPhoto(result.assets[0].uri);
      const parsed = C.parseReceipt(text);
      const remembered = await memLookup(text);
      const merchant = remembered || parsed.merchant || '';
      let category = parsed.category;
      if (remembered && parsed.category === 'Uncategorized') {
        const recls = C.classify(text, remembered);
        if (recls.name !== 'Uncategorized') category = recls.name;
      }
      // Tax-rate priority: printed on receipt > saved city rate > derived > last used
      const mem = await taxMemLookup(parsed.city);
      let taxRate: number | null = null; let rateSource = 'not detected';
      if (parsed.taxRatePrinted) { taxRate = parsed.taxRatePrinted; rateSource = 'printed on receipt'; }
      else if (mem?.fromCity) { taxRate = mem.rate; rateSource = 'remembered for this city'; }
      else if (parsed.taxRate) { taxRate = parsed.taxRate; rateSource = 'derived from receipt'; }
      else if (mem) { taxRate = mem.rate; rateSource = 'last used'; }

      setPending({
        imagePath, thumbPath, ocrText: text,
        merchant,
        date: parsed.date || new Date().toISOString().slice(0, 10),
        total: parsed.total != null ? parsed.total.toFixed(2) : '',
        salesTax: parsed.taxTotal && parsed.taxTotal > 0 ? parsed.taxTotal.toFixed(2) : '',
        taxRate, rateSource,
        category, confidence: parsed.confidence,
        merchantRemembered: !!remembered,
        city: parsed.city,
      });
      setNotes(''); setAllocs([]); setShowRaw(false); setShowSplits(false);
    } catch (e) {
      console.warn(e);
      Alert.alert('Scan failed', 'Could not read that photo — try again with more light and the receipt flat.');
    } finally {
      setBusy(false);
    }
  }, []);

  const discard = useCallback(() => { setPending(null); }, []);

  const save = useCallback(async () => {
    if (!pending) return;
    const total = parseFloat(pending.total) || 0;
    const salesTax = parseFloat(pending.salesTax);
    const merchant = pending.merchant.trim() || 'Unknown merchant';
    const remainder = total - allocs.reduce((s, a) => s + a.amount, 0);
    const fullAllocs: Allocation[] = allocs.length
      ? [{ category: pending.category, scheduleC: SC_BY_NAME[pending.category] || '', amount: Math.round(remainder * 100) / 100 }, ...allocs]
      : [];
    const id = await addReceipt({
      createdAt: new Date().toISOString(),
      merchant,
      date: pending.date,
      total,
      category: pending.category,
      scheduleC: SC_BY_NAME[pending.category] || '',
      notes: notes.trim(),
      salesTax: salesTax > 0 ? Math.round(salesTax * 100) / 100 : null,
      taxRate: pending.taxRate,
      allocations: fullAllocs,
      confidence: pending.confidence,
      ocrText: pending.ocrText,
      imagePath: pending.imagePath,
      thumbPath: pending.thumbPath,
    });
    const learned = await memLearn(pending.ocrText, merchant);
    await taxMemLearn(pending.city, pending.taxRate);
    setPending(null);
    onSaved();
    Alert.alert('Saved ✓', learned ? `I'll remember this store as "${merchant}"` : `${merchant} — $${total.toFixed(2)}`);
    // Ratings flywheel: ask after the 3rd successful scan (iOS throttles to 3/yr)
    try {
      const n = await countThisMonth();
      if (n === 3 && (await StoreReview.hasAction())) StoreReview.requestReview();
    } catch {}
    // id used only to keep TS satisfied about the awaited insert
    void id;
  }, [pending, notes, allocs, onSaved]);

  const addSplit = useCallback(() => {
    if (!pending) return;
    const amt = parseFloat(splitAmt);
    if (!amt || amt <= 0) return;
    const rate = pending.taxRate || 0;
    const withTax = splitTax && rate > 0;
    const alloc: Allocation = {
      category: splitCat,
      scheduleC: SC_BY_NAME[splitCat] || '',
      amount: Math.round(amt * (withTax ? 1 + rate : 1) * 100) / 100,
      ...(withTax ? { base: amt, tax: Math.round(amt * rate * 100) / 100 } : {}),
    };
    setAllocs((a) => [...a, alloc]);
    setSplitAmt('');
  }, [pending, splitAmt, splitCat, splitTax]);

  const splitPreview = useMemo(() => {
    const amt = parseFloat(splitAmt);
    if (!pending || !amt || amt <= 0) return null;
    const rate = pending.taxRate || 0;
    if (!splitTax || rate <= 0) return `$${amt.toFixed(2)}`;
    const tax = amt * rate;
    return `$${amt.toFixed(2)} + $${tax.toFixed(2)} tax = $${(amt + tax).toFixed(2)}`;
  }, [pending, splitAmt, splitTax]);

  const allocated = allocs.reduce((s, a) => s + a.amount, 0);
  const totalNum = pending ? parseFloat(pending.total) || 0 : 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      {!pending && !busy && (
        <>
          <Pressable style={s.hero} onPress={() => startScan(false)}>
            <Text style={s.heroIcon}>📷</Text>
            <Text style={s.heroTitle}>Scan a receipt</Text>
            <Text style={s.heroSub}>Read &amp; categorized entirely on your phone — nothing uploaded.</Text>
          </Pressable>
          <Pressable style={s.primaryBtn} onPress={() => startScan(false)}>
            <Text style={s.primaryBtnText}>Scan Receipt</Text>
          </Pressable>
          <Pressable style={s.linkBtn} onPress={() => startScan(true)}>
            <Text style={s.linkBtnText}>Choose from photo library</Text>
          </Pressable>
          <View style={s.privacy}>
            <Text style={s.privacyText}>
              <Text style={{ color: T.text, fontWeight: '600' }}>Your data never leaves this device. </Text>
              OCR runs on-device (Apple Vision) and receipts are stored locally — no upload, no account.
            </Text>
          </View>
        </>
      )}

      {busy && (
        <View style={s.progress}>
          <ActivityIndicator color={T.accent} size="large" />
          <Text style={s.progressLabel}>Reading receipt (on-device OCR)…</Text>
        </View>
      )}

      {pending && !busy && (
        <>
          {/* Snapped photo stays pinned at top until Save or Discard */}
          <Image source={{ uri: pending.imagePath }} style={s.pinned} resizeMode="contain" />
          <View style={s.review}>
            <Text style={s.h3}>Check the details</Text>
            <Text style={[s.conf, pending.merchantRemembered && { color: T.good }]}>
              {pending.merchantRemembered
                ? `★ Merchant remembered from a previous visit`
                : pending.category === 'Uncategorized'
                ? '⚠️ Couldn’t auto-categorize — please pick a category'
                : `Auto-categorized as “${pending.category}” (${pending.confidence} confidence)`}
            </Text>

            <Text style={s.label}>MERCHANT</Text>
            <TextInput style={s.input} value={pending.merchant}
              onChangeText={(v) => setPending({ ...pending, merchant: v })} placeholder="Merchant name" placeholderTextColor={T.muted2} />

            <View style={s.row3}>
              <View style={{ flex: 1.2 }}>
                <Text style={s.label}>DATE</Text>
                <TextInput style={s.input} value={pending.date}
                  onChangeText={(v) => setPending({ ...pending, date: v })} placeholder="YYYY-MM-DD" placeholderTextColor={T.muted2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>TOTAL ($)</Text>
                <TextInput style={s.input} value={pending.total} keyboardType="decimal-pad"
                  onChangeText={(v) => setPending({ ...pending, total: v })} placeholder="0.00" placeholderTextColor={T.muted2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>SALES TAX ($)</Text>
                <TextInput style={s.input} value={pending.salesTax} keyboardType="decimal-pad"
                  onChangeText={(v) => setPending({ ...pending, salesTax: v })} placeholder="0.00" placeholderTextColor={T.muted2} />
              </View>
            </View>
            <Text style={s.hint}>Tax rate: {pending.taxRate ? `${(pending.taxRate * 100).toFixed(3).replace(/\.?0+$/, '')}%` : '—'} ({pending.rateSource})</Text>

            <Text style={s.label}>MAIN TAX CATEGORY</Text>
            <Pressable style={s.input} onPress={() => setShowCats(!showCats)}>
              <Text style={{ color: T.text }}>{pending.category} ▾</Text>
            </Pressable>
            {showCats && (
              <View style={s.catList}>
                {CATEGORY_NAMES.map((name) => (
                  <Pressable key={name} style={s.catItem}
                    onPress={() => { setPending({ ...pending, category: name }); setShowCats(false); }}>
                    <Text style={{ color: name === pending.category ? T.accent : T.text, fontSize: 14 }}>{name}</Text>
                    <Text style={{ color: T.muted2, fontSize: 11 }}>{SC_BY_NAME[name]}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={s.hint}>{SC_BY_NAME[pending.category] || ''}</Text>

            {/* Splits */}
            <Pressable onPress={() => setShowSplits(!showSplits)}>
              <Text style={[s.label, { color: T.accent, marginTop: 14 }]}>
                {showSplits ? 'HIDE SPLITS ▴' : `SPLIT THIS RECEIPT ▾${allocs.length ? ` (${allocs.length})` : ''}`}
              </Text>
            </Pressable>
            {showSplits && (
              <View style={s.splitBox}>
                {allocs.map((a, i) => (
                  <View key={i} style={s.allocRow}>
                    <Text style={{ color: T.text, flex: 1, fontSize: 13 }} numberOfLines={1}>{a.category}</Text>
                    <Text style={{ color: T.muted, fontSize: 13 }}>
                      ${a.amount.toFixed(2)}{a.tax ? ` ($${a.base?.toFixed(2)} + $${a.tax.toFixed(2)} tax)` : ''}
                    </Text>
                    <Pressable onPress={() => setAllocs(allocs.filter((_, j) => j !== i))}>
                      <Text style={{ color: T.danger, paddingLeft: 10 }}>✕</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable style={s.input} onPress={() => setShowSplitCats(!showSplitCats)}>
                  <Text style={{ color: T.text, fontSize: 13 }}>{splitCat} ▾</Text>
                </Pressable>
                {showSplitCats && (
                  <View style={s.catList}>
                    {CATEGORY_NAMES.map((name) => (
                      <Pressable key={name} style={s.catItem} onPress={() => { setSplitCat(name); setShowSplitCats(false); }}>
                        <Text style={{ color: name === splitCat ? T.accent : T.text, fontSize: 14 }}>{name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput style={[s.input, { flex: 1 }]} value={splitAmt} keyboardType="decimal-pad"
                    onChangeText={setSplitAmt} placeholder="Amount $" placeholderTextColor={T.muted2} />
                  <Pressable onPress={() => setSplitTax(!splitTax)} style={s.taxToggle}>
                    <Text style={{ color: splitTax ? T.accent : T.muted2, fontSize: 13 }}>{splitTax ? '☑' : '☐'} + tax</Text>
                  </Pressable>
                </View>
                {splitPreview && <Text style={s.hint}>{splitPreview}</Text>}
                <Pressable style={s.ghostBtn} onPress={addSplit}>
                  <Text style={{ color: T.text, fontWeight: '600' }}>+ Add split</Text>
                </Pressable>
                {allocs.length > 0 && (
                  <Text style={s.hint}>
                    Remainder ${Math.max(0, totalNum - allocated).toFixed(2)} stays under “{pending.category}”.
                  </Text>
                )}
              </View>
            )}

            <Text style={s.label}>NOTES</Text>
            <TextInput style={[s.input, { minHeight: 60 }]} value={notes} onChangeText={setNotes} multiline
              placeholder="e.g. Materials for the Nakamura job" placeholderTextColor={T.muted2} />

            <Pressable onPress={() => setShowRaw(!showRaw)}>
              <Text style={[s.label, { color: T.accent, marginTop: 12 }]}>{showRaw ? 'HIDE RAW TEXT ▴' : 'SHOW RAW SCANNED TEXT ▾'}</Text>
            </Pressable>
            {showRaw && (
              <View style={s.rawBox}>
                <Pressable style={s.copyBtn}
                  onPress={async () => { await Clipboard.setStringAsync(pending.ocrText); Alert.alert('Copied'); }}>
                  <Text style={{ color: T.accent, fontSize: 12 }}>Copy</Text>
                </Pressable>
                <Text style={s.rawText}>{pending.ocrText || '(no text found)'}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
              <Pressable style={[s.ghostBtn, { flex: 1 }]} onPress={discard}>
                <Text style={{ color: T.text, fontWeight: '600' }}>Discard</Text>
              </Pressable>
              <Pressable style={[s.primaryBtn, { flex: 1, marginTop: 0 }]} onPress={save}>
                <Text style={s.primaryBtnText}>Save Receipt</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 16 },
  hero: {
    marginTop: 14, backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: T.radiusLg, alignItems: 'center', paddingVertical: 44, paddingHorizontal: 24,
  },
  heroIcon: { fontSize: 40, marginBottom: 10 },
  heroTitle: { color: T.text, fontSize: 19, fontWeight: '700' },
  heroSub: { color: T.muted, fontSize: 13, marginTop: 5, textAlign: 'center', maxWidth: 260, lineHeight: 19 },
  primaryBtn: {
    marginTop: 14, backgroundColor: T.accent, borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', shadowColor: T.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkBtnText: { color: T.muted, fontSize: 13 },
  privacy: {
    marginTop: 18, backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: T.radius, padding: 14,
  },
  privacyText: { color: T.muted, fontSize: 12.5, lineHeight: 19 },
  progress: { marginTop: 40, alignItems: 'center', gap: 14 },
  progressLabel: { color: T.muted, fontSize: 13 },
  pinned: {
    marginTop: 10, width: '100%', height: 170, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  review: {
    marginTop: 12, backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: T.radius, padding: 16, marginBottom: 20,
  },
  h3: { color: T.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  conf: { color: T.muted, fontSize: 12.5, marginBottom: 12 },
  label: { color: T.muted2, fontSize: 10, letterSpacing: 0.6, marginTop: 12, marginBottom: 5, fontWeight: '600' },
  input: {
    backgroundColor: T.bg2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    color: T.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
  },
  row3: { flexDirection: 'row', gap: 8 },
  hint: { color: T.muted2, fontSize: 12, marginTop: 6 },
  catList: {
    backgroundColor: T.bg2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    marginTop: 6, maxHeight: 300,
  },
  catItem: { paddingHorizontal: 12, paddingVertical: 9, borderBottomColor: T.line, borderBottomWidth: StyleSheet.hairlineWidth },
  splitBox: { backgroundColor: T.bg2, borderRadius: 10, padding: 10, gap: 8, borderColor: T.line, borderWidth: 1 },
  allocRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  taxToggle: { paddingHorizontal: 10, paddingVertical: 10 },
  ghostBtn: {
    backgroundColor: T.card2, borderColor: T.line, borderWidth: 1, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  rawBox: { backgroundColor: T.bg2, borderRadius: 10, padding: 10, borderColor: T.line, borderWidth: 1 },
  copyBtn: { alignSelf: 'flex-end', padding: 4 },
  rawText: { color: T.muted, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
RS_EOF

echo "    screens (1/3) written"

cat > src/screens/ReceiptsScreen.tsx <<'RS_EOF'
// Receipts list + detail modal (image, fields, edit, delete, raw-text copy).
import React, { useCallback, useState } from 'react';
import {
  Alert, FlatList, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { T } from '../lib/theme';
import { deleteReceipt, updateReceipt, type Receipt } from '../lib/db';
import { deleteReceiptFiles } from '../lib/ocr';
import { SC_BY_NAME, allocationsOf } from '../lib/rows';

const CATEGORY_NAMES: string[] = (require('../lib/classifier.js').CATEGORIES as { name: string }[]).map((c) => c.name);

export default function ReceiptsScreen({ receipts, onChanged }: { receipts: Receipt[]; onChanged: () => void }) {
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [showCats, setShowCats] = useState(false);

  const remove = useCallback((r: Receipt) => {
    Alert.alert('Delete receipt?', `${r.merchant} — $${r.total.toFixed(2)}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (r.id != null) await deleteReceipt(r.id);
          await deleteReceiptFiles(r);
          setSelected(null);
          onChanged();
        },
      },
    ]);
  }, [onChanged]);

  const saveEdits = useCallback(async () => {
    if (!selected) return;
    await updateReceipt(selected);
    setSelected(null);
    onChanged();
  }, [selected, onChanged]);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={receipts}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        ListEmptyComponent={
          <Text style={{ color: T.muted, textAlign: 'center', marginTop: 60 }}>
            No receipts yet — scan your first one on the Capture tab.
          </Text>
        }
        renderItem={({ item }) => {
          const allocs = allocationsOf(item);
          return (
            <Pressable style={s.card} onPress={() => setSelected({ ...item })}>
              {item.thumbPath
                ? <Image source={{ uri: item.thumbPath }} style={s.thumb} />
                : <View style={[s.thumb, { alignItems: 'center', justifyContent: 'center' }]}><Text>🧾</Text></View>}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardM} numberOfLines={1}>{item.merchant}</Text>
                <Text style={s.cardSub} numberOfLines={1}>
                  {item.date} · {item.category}{allocs.length > 1 ? ` +${allocs.length - 1} splits` : ''}
                </Text>
              </View>
              <Text style={s.cardAmt}>${item.total.toFixed(2)}</Text>
            </Pressable>
          );
        }}
      />

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (
          <ScrollView style={s.detail} contentContainerStyle={{ padding: 16, paddingBottom: 80, paddingTop: 60 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.detailTitle} numberOfLines={1}>{selected.merchant}</Text>
              <Pressable onPress={() => setSelected(null)} style={{ padding: 8 }}>
                <Text style={{ color: T.muted, fontSize: 22 }}>✕</Text>
              </Pressable>
            </View>
            {selected.imagePath && (
              <Image source={{ uri: selected.imagePath }} style={s.detailImg} resizeMode="contain" />
            )}
            <Text style={s.label}>MERCHANT</Text>
            <TextInput style={s.input} value={selected.merchant}
              onChangeText={(v) => setSelected({ ...selected, merchant: v })} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1.2 }}>
                <Text style={s.label}>DATE</Text>
                <TextInput style={s.input} value={selected.date}
                  onChangeText={(v) => setSelected({ ...selected, date: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>TOTAL ($)</Text>
                <TextInput style={s.input} keyboardType="decimal-pad" value={String(selected.total)}
                  onChangeText={(v) => setSelected({ ...selected, total: parseFloat(v) || 0 })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>SALES TAX ($)</Text>
                <TextInput style={s.input} keyboardType="decimal-pad" value={selected.salesTax != null ? String(selected.salesTax) : ''}
                  onChangeText={(v) => setSelected({ ...selected, salesTax: parseFloat(v) > 0 ? parseFloat(v) : null })} />
              </View>
            </View>
            <Text style={s.label}>MAIN TAX CATEGORY</Text>
            <Pressable style={s.input} onPress={() => setShowCats(!showCats)}>
              <Text style={{ color: T.text }}>{selected.category} ▾</Text>
            </Pressable>
            {showCats && (
              <View style={s.catList}>
                {CATEGORY_NAMES.map((name) => (
                  <Pressable key={name} style={s.catItem}
                    onPress={() => { setSelected({ ...selected, category: name, scheduleC: SC_BY_NAME[name] || '' }); setShowCats(false); }}>
                    <Text style={{ color: name === selected.category ? T.accent : T.text, fontSize: 14 }}>{name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Text style={s.hint}>{SC_BY_NAME[selected.category] || ''}</Text>
            {allocationsOf(selected).length > 1 && (
              <>
                <Text style={s.label}>SPLITS</Text>
                {allocationsOf(selected).map((a, i) => (
                  <Text key={i} style={{ color: T.muted, fontSize: 13, marginBottom: 2 }}>
                    · {a.category}: ${a.amount.toFixed(2)}{a.tax ? ` ($${a.base?.toFixed(2)} + $${a.tax.toFixed(2)} tax)` : ''}
                  </Text>
                ))}
              </>
            )}
            <Text style={s.label}>NOTES</Text>
            <TextInput style={[s.input, { minHeight: 50 }]} multiline value={selected.notes}
              onChangeText={(v) => setSelected({ ...selected, notes: v })} />

            <Pressable style={{ marginTop: 14 }}
              onPress={async () => { await Clipboard.setStringAsync(selected.ocrText || ''); Alert.alert('Raw text copied'); }}>
              <Text style={{ color: T.accent, fontSize: 12, fontWeight: '600' }}>COPY RAW SCANNED TEXT</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable style={s.dangerBtn} onPress={() => remove(selected)}>
                <Text style={{ color: T.danger, fontWeight: '600' }}>Delete</Text>
              </Pressable>
              <Pressable style={s.primaryBtn} onPress={saveEdits}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Save Changes</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: T.radius,
    padding: 12, marginBottom: 10,
  },
  thumb: { width: 46, height: 46, borderRadius: 8, backgroundColor: T.bg2 },
  cardM: { color: T.text, fontSize: 15, fontWeight: '600' },
  cardSub: { color: T.muted2, fontSize: 12, marginTop: 2 },
  cardAmt: { color: T.text, fontSize: 15, fontWeight: '700' },
  detail: { flex: 1, backgroundColor: T.bg },
  detailTitle: { color: T.text, fontSize: 18, fontWeight: '700', flex: 1 },
  detailImg: { width: '100%', height: 260, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: 10 },
  label: { color: T.muted2, fontSize: 10, letterSpacing: 0.6, marginTop: 14, marginBottom: 5, fontWeight: '600' },
  input: {
    backgroundColor: T.bg2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    color: T.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15,
  },
  hint: { color: T.muted2, fontSize: 12, marginTop: 6 },
  catList: { backgroundColor: T.bg2, borderColor: T.line, borderWidth: 1, borderRadius: 10, marginTop: 6 },
  catItem: { paddingHorizontal: 12, paddingVertical: 9, borderBottomColor: T.line, borderBottomWidth: StyleSheet.hairlineWidth },
  dangerBtn: {
    flex: 1, borderColor: 'rgba(255,107,107,0.45)', borderWidth: 1, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  primaryBtn: { flex: 1, backgroundColor: T.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
});
RS_EOF

cat > src/screens/SummaryScreen.tsx <<'RS_EOF'
// Summary: totals by tax form/category, sales-tax tracking, exports (CSV free;
// XLSX/TXF/QBO are Pro), JSON backup, version stamp.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { T } from '../lib/theme';
import type { Receipt } from '../lib/db';
import { exportRows, isBusiness, allocationsOf } from '../lib/rows';
import { exportCSV, exportTXF, exportQBO, exportXLSX, exportBackup } from '../lib/exportShare';
import { isPro, presentPaywall } from '../lib/purchases';
import { versionStamp } from '../lib/version';
const C = require('../lib/classifier.js');

export default function SummaryScreen({ receipts, pro, onProChanged }: {
  receipts: Receipt[]; pro: boolean; onProChanged: () => void;
}) {
  const [busyExport, setBusyExport] = useState<string | null>(null);

  const stats = useMemo(() => {
    const byForm = new Map<string, Map<string, number>>();
    let bizTotal = 0, personalTotal = 0, taxBiz = 0, taxPersonal = 0;
    for (const r of receipts) {
      const allocs = allocationsOf(r);
      const tot = r.total || allocs.reduce((s, a) => s + a.amount, 0) || 1;
      for (const a of allocs) {
        const form = C.taxFormOf(a.category);
        if (!byForm.has(form)) byForm.set(form, new Map());
        const m = byForm.get(form)!;
        m.set(a.category, (m.get(a.category) || 0) + a.amount);
        if (isBusiness(a.category)) bizTotal += a.amount; else personalTotal += a.amount;
        if (r.salesTax && r.salesTax > 0) {
          const portion = r.salesTax * (a.amount / tot);
          if (isBusiness(a.category)) taxBiz += portion; else taxPersonal += portion;
        }
      }
    }
    const formOrder = ['Schedule C', 'Schedule C Part III (COGS)', 'Form 8829 (Home Office)', 'Form 4562 (Depreciation)', 'Schedule A (Itemized)', 'Review needed', 'None (personal)'];
    const forms = [...byForm.entries()].sort((a, b) => {
      const ia = formOrder.indexOf(a[0]); const ib = formOrder.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return { forms, bizTotal, personalTotal, taxBiz, taxPersonal };
  }, [receipts]);

  const gated = async (name: string, fn: () => Promise<void>, needsPro: boolean) => {
    if (needsPro && !pro) {
      const unlocked = await presentPaywall();
      if (!unlocked) return;
      onProChanged();
    }
    setBusyExport(name);
    try { await fn(); }
    catch (e) { console.warn(e); Alert.alert('Export failed', String(e)); }
    finally { setBusyExport(null); }
  };

  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={s.statRow}>
        <View style={s.stat}>
          <Text style={s.statLabel}>BUSINESS</Text>
          <Text style={[s.statVal, { color: T.good }]}>${stats.bizTotal.toFixed(2)}</Text>
        </View>
        <View style={s.stat}>
          <Text style={s.statLabel}>PERSONAL</Text>
          <Text style={s.statVal}>${stats.personalTotal.toFixed(2)}</Text>
        </View>
      </View>

      {stats.forms.map(([form, cats]) => (
        <View key={form} style={s.card}>
          <Text style={s.formTitle}>{form.toUpperCase()}</Text>
          {[...cats.entries()].sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <View key={cat} style={s.catLine}>
              <Text style={{ color: T.text, fontSize: 13.5, flex: 1 }} numberOfLines={1}>{cat}</Text>
              <Text style={{ color: T.muted, fontSize: 13.5 }}>${amt.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ))}

      {(stats.taxBiz > 0 || stats.taxPersonal > 0) && (
        <View style={s.card}>
          <Text style={s.formTitle}>SALES TAX PAID</Text>
          <View style={s.catLine}><Text style={s.taxLabel}>On business purchases</Text><Text style={{ color: T.muted }}>${stats.taxBiz.toFixed(2)}</Text></View>
          <View style={s.catLine}><Text style={s.taxLabel}>On personal (Schedule A line 5a)</Text><Text style={{ color: T.muted }}>${stats.taxPersonal.toFixed(2)}</Text></View>
        </View>
      )}

      <View style={s.card}>
        <Text style={s.formTitle}>EXPORT</Text>
        {([
          ['csv', 'CPA CSV (organized by IRS form)', false, () => exportCSV(receipts)],
          ['xlsx', 'Excel workbook (.xlsx)' + (pro ? '' : '  ·  PRO'), true, () => exportXLSX(receipts)],
          ['txf', 'TXF for tax software' + (pro ? '' : '  ·  PRO'), true, () => exportTXF(receipts)],
          ['qbo', 'QuickBooks 3-column CSV' + (pro ? '' : '  ·  PRO'), true, () => exportQBO(receipts)],
          ['backup', 'Full JSON backup', false, () => exportBackup(receipts)],
        ] as [string, string, boolean, () => Promise<void>][]).map(([key, label, needsPro, fn]) => (
          <Pressable key={key} style={s.exportBtn} disabled={busyExport != null}
            onPress={() => gated(key, fn, needsPro)}>
            {busyExport === key
              ? <ActivityIndicator color={T.accent} />
              : <Text style={{ color: T.text, fontSize: 14 }}>{label}</Text>}
          </Pressable>
        ))}
      </View>

      {!pro && (
        <Pressable style={s.proBtn} onPress={async () => { if (await presentPaywall()) onProChanged(); }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Upgrade to ReceiptSnap Pro</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 3 }}>
            Unlimited scans · every export format · $39.99/yr
          </Text>
        </Pressable>
      )}

      <Text style={s.version}>{versionStamp()}</Text>
      <Text style={[s.version, { marginTop: 2 }]}>
        {pro ? '★ Pro' : 'Free plan'} · {receipts.length} receipt{receipts.length === 1 ? '' : 's'} · 100% on-device
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: {
    flex: 1, backgroundColor: T.card, borderColor: T.line, borderWidth: 1,
    borderRadius: T.radius, padding: 14,
  },
  statLabel: { color: T.muted2, fontSize: 10, letterSpacing: 0.6, fontWeight: '600' },
  statVal: { color: T.text, fontSize: 22, fontWeight: '700', marginTop: 4 },
  card: {
    backgroundColor: T.card, borderColor: T.line, borderWidth: 1, borderRadius: T.radius,
    padding: 14, marginTop: 12,
  },
  formTitle: { color: T.accent, fontSize: 11, letterSpacing: 0.8, fontWeight: '700', marginBottom: 8 },
  catLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  taxLabel: { color: T.text, fontSize: 13.5, flex: 1 },
  exportBtn: {
    backgroundColor: T.card2, borderColor: T.line, borderWidth: 1, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 12, marginBottom: 8,
  },
  proBtn: {
    backgroundColor: T.accent, borderRadius: T.radius, padding: 16, alignItems: 'center', marginTop: 14,
  },
  version: { color: T.muted2, fontSize: 11, textAlign: 'center', marginTop: 18, letterSpacing: 0.3 },
});
RS_EOF

cat > App.tsx <<'RS_EOF'
// ReceiptSnap — root component. Custom three-tab shell (no navigation library:
// fewer native deps = safer single EAS build), same layout as the PWA.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { T } from './src/lib/theme';
import { allReceipts, type Receipt } from './src/lib/db';
import { initPurchases, isPro } from './src/lib/purchases';
import CaptureScreen from './src/screens/CaptureScreen';
import ReceiptsScreen from './src/screens/ReceiptsScreen';
import SummaryScreen from './src/screens/SummaryScreen';

type Tab = 'capture' | 'receipts' | 'summary';

function Root() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('capture');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [pro, setPro] = useState(false);

  const refresh = useCallback(async () => {
    setReceipts(await allReceipts());
    setPro(await isPro());
  }, []);

  useEffect(() => {
    initPurchases();
    refresh();
  }, [refresh]);

  return (
    <View style={[s.app, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.brand}>
          Receipt<Text style={{ color: T.accent }}>Snap</Text>
        </Text>
        <View style={s.badge}>
          <View style={s.dot} />
          <Text style={s.badgeText}>ON-DEVICE</Text>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'capture' && <CaptureScreen onSaved={() => { refresh(); setTab('receipts'); }} />}
        {tab === 'receipts' && <ReceiptsScreen receipts={receipts} onChanged={refresh} />}
        {tab === 'summary' && <SummaryScreen receipts={receipts} pro={pro} onProChanged={refresh} />}
      </View>

      <View style={[s.tabbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {([
          ['capture', '📷', 'Capture'],
          ['receipts', '🧾', 'Receipts'],
          ['summary', '📊', 'Summary'],
        ] as [Tab, string, string][]).map(([key, icon, label]) => (
          <Pressable key={key} style={s.tabBtn} onPress={() => { setTab(key); if (key !== 'capture') refresh(); }}>
            <Text style={{ fontSize: 20, opacity: tab === key ? 1 : 0.45 }}>{icon}</Text>
            <Text style={[s.tabLabel, tab === key && { color: T.accent }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <StatusBar style="light" />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomColor: T.line, borderBottomWidth: 1,
  },
  brand: { color: T.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderColor: T.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: T.good },
  badgeText: { color: T.muted, fontSize: 10.5, fontWeight: '600', letterSpacing: 0.6 },
  tabbar: {
    flexDirection: 'row', borderTopColor: T.line, borderTopWidth: 1,
    backgroundColor: T.bg2, paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { color: T.muted2, fontSize: 11, fontWeight: '600' },
});
RS_EOF

cat > __tests__/classifier.test.js <<'RS_EOF'
// Classifier regression tests for the mobile copy — run with `npm run test:unit`.
// Uses the same real-receipt fixtures as the PWA suite; guards against the
// mobile copy of classifier.js drifting from the web copy.
const fs = require('fs');
const path = require('path');
const C = require('../src/lib/classifier.js');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ← got: ' + extra}`);
}

const fx = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

// Costco #1: total beats "items sold" + instant savings
const r1 = C.parseReceipt(fx('costco-raw.txt'));
check('costco1 total 140.35', r1.total === 140.35, r1.total);

// Costco #2: OCR-garbled "$172{37" wins; FSA lines excluded from total AND tax
const r2 = C.parseReceipt(fx('costco2-raw.txt'));
check('costco2 total 172.37 (not FSA 16.99)', r2.total === 172.37, r2.total);
check('costco2 tax 7.16 (not FSA 16.99)', r2.taxTotal === 7.16, r2.taxTotal);
check('costco2 printed rate 4.712%', Math.abs(r2.taxRatePrinted - 0.04712) < 1e-6, r2.taxRatePrinted);

// Safeway: double-column item lines
const r3 = C.parseReceipt(fx('safeway-raw.txt'));
check('safeway double-column items found', r3.items.length >= 2, r3.items.length);

// Synthetic totals
check('grand total beats subtotal', C.parseReceipt('MART\nSUBTOTAL 90.00\nTAX 7.20\nGRAND TOTAL 97.20').total === 97.20);
check('credit -A ignored', C.parseReceipt('STORE\nCOUPON 5.00-A\nTOTAL DUE 41.25').total === 41.25);

// Classification sanity
const meal = C.parseReceipt('The Rusty Grill\n123 Main St\nBURGER 12.99\nGRATUITY 3.00\nTOTAL 25.77');
check('meal categorized', meal.category === 'Meals & Entertainment', meal.category);

// Exporters (mobile copy)
const X = require('../src/lib/exporters.js');
const rows = [
  { date: '2026-07-01', merchant: 'Home Depot', amount: 74.45, category: 'Supplies & Materials', sc: 'Line 22 — Supplies', notes: '', rid: 'R1', split: '', business: true, taxPortion: 3.5 },
  { date: '2026-07-02', merchant: 'Ad Co', amount: 50.0, category: 'Advertising & Marketing', sc: 'Line 8 — Advertising', notes: '', rid: 'R2', split: '', business: true, taxPortion: null },
];
const csv = X.buildCpaCSV(rows);
check('CSV BOM + header', csv.charCodeAt(0) === 0xFEFF && csv.includes('Date,Merchant,Amount,Tax Form'));
const txf = X.buildTXF(rows, new Date(2026, 7, 1));
check('TXF codes present', txf.content.includes('N304') && txf.content.includes('N301'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
RS_EOF

cat > __tests__/costco-raw.txt <<'RS_EOF'
Bw  Yai Grup

Hawaii Kai #120
333A Keahnle Strogt
Honolulit HI 95028

SELF-CHECKOUT

19 Member 11195 5285

E 1331732 MINL CODK        "39 A
494609 ECO HALF ATH     "1.49 f
Z 1569515 HUMM M+, /CAN    12.79 A
F 2800000000 HI BEVERAGE      0.48
A    724733 ORG BURRITO     11.99 A
E 2009847 MANGO ANAPS      7.99 A
2007585 CHKN pri -         8.99 A
E   2007555 CHKN /BAO         8.99 A
E 2007555 CHKN/BAO         R99 A
E. 2007585 CHKN BAO       C99 A
E 1955255 POWER VEG      1. 49 A
720 REYNLDS FOIL    2%. 38
0000374624 / 740           6.30-A
PESTO |     9.99 A
134.06
-29
E           990551 BAS:
SUBTOTAL
TAX
wx TOTAL
AIL. 0000000031015
Gee 06823     Rep: 70061
Visa           Resp: APPROVED
Tran ID: 608100206823....
APPROVED ~ Purchake
AMOUNT: $140.35
03/.7/2026 16:39 120 206 241 706
140.35
CHANGE               0.00
A 4.712% GET                 6.29
TOTAL TAX                   6.29
TOTAL NUMP     ITEMS SOLD = 12
INSTANT Sf    a           $6.30
Items So. = 12
09 03/22/2026 16:39
RS_EOF

cat > __tests__/costco2-raw.txt <<'RS_EOF'
20
Howat Kai #1

333 keahole Street
Honolulu, HI 96828

. SUBTOTAL
Tax                               .
ly  TOTAL

XXXXKARNNNK26S)
AID: 000000431010

Sesh 25899   APP: 094021
Visa    Resp if APPROVED

Tran i; 619700208895. . ..

 SELF-CHECKOUT
APPROVED - P vase
AMOUNT: $172{37

07/16/2026 17:03:120 205 201 705

A 4.712% GET        \       1.76
TOTAL TAX                 7.16
TOTAL NUMBER OF ITEMS SOLD = 9
INSTANT SAVINGS          $12.70
ZAYpYE: 17:03 120 205 201 705

FSA N/TAX AMT(F) = 16.99
FSA TAX         - it Cc

mf

OP: 705 ps “0
Please Come Rgain
whse:120 Trm:205 Trn:201 OP:705

Items Sold: 9
QU 07/16/2026 17:03
RS_EOF

cat > __tests__/safeway-raw.txt <<'RS_EOF'
SAFEWAY €).
Store 216 Dir Chris Brannum
Main: (808) 396-6337 Rx:
377 KEAHOLE STREET
HONOLULU HI 96825
LT
REF: 652413408560 AUTH: 00024321
PAYMENT AMOUNT            8.88
TVR 0000000000
Visa                 8.88
CHANGE                0.00
YOUR POINTS
Points Earned Today 8
Points Available 18
GROCERY                                Price You Pay
2113016285 516 BLACK PEPPER              4.88 4.968
2113060304 SIG CHILI POWDER              3.48 3.498
TAX          Co             0.40
*#x% BALANCE                k     8.88
Credit Purchase 07/17/26 21:24
CARD § ¥®*kudsxnkxxx0866
AL VISA CREDIT
AID AD000000031010
TOTAL NUMBER OF ITEMS SOLD = 2
07/17/26 21:24 215 96 331     8895
Thank you for shopping Safeway!
For SAFEWAY FOR U questions call
871-276-9637 or Safeway.com/foru
RS_EOF

cat > RUNBOOK-EAS-BUILD.md <<'RS_EOF'
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
   bundle ID `com.vaultvision.receiptsnap`.
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
RS_EOF

echo "==> [6/7] Generating app icons from code (PIL)"
pip3 install --quiet pillow 2>/dev/null || pip3 install --quiet --break-system-packages pillow
python3 - <<'RS_PYEOF'
from PIL import Image, ImageDraw, ImageFilter
import math

S = 2048  # supersample, downscale to 1024
ACCENT = (79,124,255)        # #4f7cff (the blue you liked)
ACCENT_HI = (124,157,255)

def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))

img = Image.new('RGB',(S,S),(11,16,26))
px = img.load()
top=(14,20,38); bot=(9,13,22)
for y in range(S):
    row = lerp(top,bot,y/S)
    for x in range(S):
        px[x,y]=row
# radial accent glow near top-center
glow = Image.new('L',(S,S),0); gd=ImageDraw.Draw(glow)
gd.ellipse([S*0.12,-S*0.28,S*0.88,S*0.5], fill=90)
glow=glow.filter(ImageFilter.GaussianBlur(S*0.10))
acc_layer=Image.new('RGB',(S,S),ACCENT)
img=Image.composite(acc_layer,img,glow.point(lambda v:int(v*0.5)))

d=ImageDraw.Draw(img,'RGBA')

# ---- receipt geometry ----
rw,rh=int(S*0.44),int(S*0.55)
rx=(S-rw)//2; ry=int(S*0.20)
rad=int(S*0.045)

# soft shadow
sh=Image.new('RGBA',(S,S),(0,0,0,0)); sd=ImageDraw.Draw(sh)
sd.rounded_rectangle([rx,ry+int(S*0.02),rx+rw,ry+rh],radius=rad,fill=(0,0,0,150))
sh=sh.filter(ImageFilter.GaussianBlur(S*0.03))
img=Image.alpha_composite(img.convert('RGBA'),sh)
d=ImageDraw.Draw(img,'RGBA')

# receipt body (rounded top, zigzag bottom) — build a mask
paper=(244,247,251)
d.rounded_rectangle([rx,ry,rx+rw,ry+rh],radius=rad,fill=paper)
# zigzag bottom
n=7; step=rw/n; zz=int(S*0.028)
pts=[(rx,ry+rh)]
for i in range(n):
    pts.append((rx+step*(i+0.5),ry+rh+zz))
    pts.append((rx+step*(i+1),ry+rh))
pts+=[(rx+rw,ry+rh-2),(rx,ry+rh-2)]
d.polygon(pts,fill=paper)

# text lines
lx=rx+int(rw*0.16); lw=int(rw*0.68)
def bar(yfrac,wfrac,color,h=0.034):
    y=ry+int(rh*yfrac)
    d.rounded_rectangle([lx,y,lx+int(rw*wfrac),y+int(rh*h)],radius=int(S*0.012),fill=color)
bar(0.14,0.62,(20,28,44),0.05)      # merchant (bold dark)
bar(0.30,0.68,(150,163,184))
bar(0.40,0.55,(150,163,184))
bar(0.50,0.68,(150,163,184))
# total line in accent
y=ry+int(rh*0.66)
d.rounded_rectangle([lx,y,lx+int(rw*0.40),y+int(rh*0.06)],radius=int(S*0.014),fill=ACCENT)
d.rounded_rectangle([lx+int(rw*0.50),y,lx+int(rw*0.68),y+int(rh*0.06)],radius=int(S*0.014),fill=ACCENT)

# ---- viewfinder corner brackets (brand motif) in accent ----
pad=int(S*0.085); bl=int(S*0.11); bt=int(S*0.028); br=int(S*0.02)
def bracket(cx,cy,dx,dy):
    d.rounded_rectangle([cx,cy,cx+dx*bl if dx>0 else cx, cy+bt if True else cy],radius=br) # placeholder
# draw four L brackets manually
def L(x,y,hx,hy):
    # horizontal arm
    d.rounded_rectangle(sorted([x,x+hx])+[0,0],radius=0) if False else None
# simpler: draw brackets as lines with round caps
def corner(x,y,sx,sy):
    arm=int(S*0.10); thick=int(S*0.022)
    d.line([(x,y),(x+sx*arm,y)],fill=ACCENT,width=thick)
    d.line([(x,y),(x,y+sy*arm)],fill=ACCENT,width=thick)
o=int(S*0.085)
corner(o,o,1,1)
corner(S-o,o,-1,1)
corner(o,S-o,1,-1)
corner(S-o,S-o,-1,-1)
# round the bracket joints
for (x,y) in [(o,o),(S-o,o),(o,S-o),(S-o,S-o)]:
    r=int(S*0.011); d.ellipse([x-r,y-r,x+r,y+r],fill=ACCENT)

out=img.convert('RGB').resize((1024,1024),Image.LANCZOS)
out.save('assets_icon_1024.png')
for sz in (512,192,180):
    out.resize((sz,sz),Image.LANCZOS).save(f'icon-{sz}.png')
print('icon generated')
RS_PYEOF
cp assets_icon_1024.png assets/icon.png
cp assets_icon_1024.png assets/splash-icon.png
cp icon-512.png assets/adaptive-icon.png
rm -f assets_icon_1024.png icon-512.png icon-192.png icon-180.png
echo "    icons generated"

echo "==> [7/7] Verifying the reconstructed project"
node __tests__/classifier.test.js
npx tsc --noEmit && echo "    TypeScript: clean"

echo ""
echo "============================================================"
echo " ReceiptSnap Mobile reconstructed at: $APP_DIR"
echo " Verified: unit tests green + TypeScript clean."
echo ""
echo " Next steps (run these here, one group at a time):"
echo "   cd $APP_DIR"
echo "   npx eas-cli@latest login"
echo "   npx eas init"
echo "   npx eas update:configure     # REQUIRED before building"
echo "   npx eas device:create        # register your iPhone (open link on phone)"
echo "   npx eas build --profile development --platform ios"
echo "============================================================"
