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
