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
