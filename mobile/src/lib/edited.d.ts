export interface ParsedSnapshot {
  merchant: string;
  date: string;
  total: number | null;
  salesTax: number | null;
  category: string;
  confidence: string;
}

export const COMPARED: string[];
export function changedFields(snapshot: ParsedSnapshot | null, receipt: any): string[] | null;
export function wasEdited(snapshot: ParsedSnapshot | null, receipt: any): boolean | null;
export function readSnapshot(raw: string | ParsedSnapshot | null): ParsedSnapshot | null;
export function snapshotOf(parsed: any): ParsedSnapshot;
