export interface SizedReceipt {
  imagePath?: string | null;
  size: number;
  [k: string]: unknown;
}

export interface BodyOptions {
  message?: string;
  version?: string;
  receiptCount?: number | null;
  includeDiagnostics?: boolean;
  includeImages?: boolean;
  imageCount?: number | null;
}

export const MAX_ATTACH_BYTES: number;
export const ATTACHMENT_LABELS: { diagnostics: string; images: string };
export function selectImages(
  receipts: SizedReceipt[],
  maxBytes?: number,
): { chosen: SizedReceipt[]; skipped: number; bytes: number };
export function buildBody(opts: BodyOptions): string;
export function buildSubject(kind: 'scan' | 'general', version?: string): string;
