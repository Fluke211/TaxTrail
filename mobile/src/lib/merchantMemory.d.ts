export interface MerchantEntry { fp: string[]; name: string }
export function fingerprint(ocrText: string): string[];
export function matchScore(fp: string[], entry: MerchantEntry): number;
export function bestIndex(entries: MerchantEntry[], fp: string[]): number;
export function lookup(entries: MerchantEntry[], ocrText: string): string | null;
export function learn(entries: MerchantEntry[], ocrText: string, name: string): MerchantEntry[] | null;
export function forget(entries: MerchantEntry[], ocrText: string): { entries: MerchantEntry[]; name: string | null };
export const MAX_ENTRIES: number;
