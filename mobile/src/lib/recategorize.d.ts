export const REMEMBERED: 'remembered';
export function resolveCategory(
  parsed: { category?: string; confidence?: string } | null,
  remembered: string | null,
  reclassify: (name: string) => { name: string; confidence?: string },
): { category: string; confidence: string };
