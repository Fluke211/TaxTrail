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

/*
 * The ceiling the CLASSIFIER already applies to a printed rate.
 *
 * This gate is the last thing between a misread percentage and a city's
 * stored rate, and it was the loosest in the app: the classifier stopped
 * accepting a printed rate above 12% in r40, and refuses a derived rate above
 * 11.5%, but this still allowed anything up to 25%. The write gate must never
 * be looser than the read gate, or the tightening upstream buys nothing
 * (D-105).
 */
const MAX_LEARNABLE_RATE = 0.12;

export async function taxMemLearn(city: string | null, rate: number | null): Promise<void> {
  if (!rate || rate <= 0 || rate > MAX_LEARNABLE_RATE) return;
  const mem = await loadTax();
  if (city) mem.cities[city] = rate;
  mem.last = rate;
  await AsyncStorage.setItem(TAX_KEY, JSON.stringify(mem));
}

/*
 * Forget every learned tax rate.
 *
 * D-095 and D-096 each fixed a SOURCE of a poisoned city rate: a service fee
 * read as 4%, a suggested-tip percentage read as 2%, an 18% auto-gratuity.
 * Nothing ever gave the user a way to undo a poisoning that had already
 * happened, and a stored rate is used for every later receipt in that city,
 * so one bad scan kept being wrong long after the parser stopped making that
 * mistake. Deleting every receipt did not clear it either: this is a separate
 * AsyncStorage key and the delete never touched it.
 *
 * Deliberately all of them rather than one city. The user knows a rate is
 * wrong; they do not know which city string the parser filed it under, and
 * the only cost of clearing the lot is that the next receipt in each city
 * reads its rate off the receipt again, which is what it should prefer anyway.
 */
export async function taxMemForgetAll(): Promise<number> {
  const mem = await loadTax();
  const n = Object.keys(mem.cities || {}).length;
  await AsyncStorage.setItem(TAX_KEY, JSON.stringify({ cities: {}, last: null }));
  return n;
}
