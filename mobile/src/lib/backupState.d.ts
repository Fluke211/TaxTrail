export type BackupLevel = 'empty' | 'never' | 'behind' | 'current';
export interface BackupAdvice {
  level: BackupLevel;
  unexported: number;
  daysSince: number | null;
}
export function backupAdvice(opts: {
  createdAts: string[];
  lastExportAt?: string | null;
  lastExportNewest?: string | null;
  now?: Date | string;
}): BackupAdvice;
export function backupSummary(advice: BackupAdvice): string | null;
