import type { Receipt } from './db';

export type RangeKind = 'all' | 'ytd' | 'year' | 'custom';

export interface ExportRange {
  kind: RangeKind;
  from: string | null;
  to: string | null;
  label: string;
  slug: string;
}

export function isoDay(d: Date): string;
export function makeRange(
  kind: RangeKind,
  opts?: { now?: Date; year?: number; from?: string | null; to?: string | null },
): ExportRange;
export function inRange(date: string, range: ExportRange): boolean;
export function filterByRange(
  receipts: Receipt[],
  range: ExportRange,
): { receipts: Receipt[]; undated: Receipt[] };
export function exportFileName(base: string, ext: string, range: ExportRange, now?: Date): string;
export function yearsPresent(receipts: Receipt[]): number[];
