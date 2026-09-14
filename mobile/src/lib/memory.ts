// Merchant + tax-rate memory, ported from the PWA (localStorage → AsyncStorage).
//
// The merchant rules live in merchantMemory.js — plain JS and storage-free, so
// the test harness can reach them. This file is the AsyncStorage wrapper and
// nothing more; when the rules lived here, looking up and correcting disagreed
// about which entry a receipt belonged to and a correction did not correct
// (D-092).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MerchantEntry } from './merchantMemory';
const M = require('./merchantMemory.js');

const MERCHANT_KEY = 'rs.merchantMemory.v1';
const TAX_KEY = 'rs.taxMemory.v1';

interface TaxMemory { cities: Record<string, number>; last: number | null }

async function loadMerchants(): Promise<MerchantEntry[]> {
  try { return JSON.parse((await AsyncStorage.getItem(MERCHANT_KEY)) || '[]'); } catch { return []; }
}

async function saveMerchants(entries: MerchantEntry[]): Promise<void> {
  await AsyncStorage.setItem(MERCHANT_KEY, JSON.stringify(entries));
}

export async function memLookup(ocrText: string): Promise<string | null> {
  return M.lookup(await loadMerchants(), ocrText);
}

export async function memLearn(ocrText: string, name: string): Promise<boolean> {
  const next = M.learn(await loadMerchants(), ocrText, name);
  if (!next) return false;
  await saveMerchants(next);
  return true;
}

/** Forget the name this receipt matches. Returns what was dropped, or null. */
export async function memForget(ocrText: string): Promise<string | null> {
  const { entries, name } = M.forget(await loadMerchants(), ocrText);
  if (name) await saveMerchants(entries);
  return name;
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
