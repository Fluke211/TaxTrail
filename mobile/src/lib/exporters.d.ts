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
