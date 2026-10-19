// When the last FULL receipt archive was made, and what it contained.
//
// The decision logic is in backupState.js; this is only the AsyncStorage
// wrapper, same split as memory.ts. Namespaced like the other stored keys.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Receipt } from './db';

const KEY = 'rs.archiveMark.v1';

export interface ArchiveMark {
  /** When the archive was handed to the share sheet, ISO. */
  at: string;
  /** The newest createdAt the archive contained, ISO, or null if it was empty. */
  newest: string | null;
  count: number;
}

export async function readArchiveMark(): Promise<ArchiveMark | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const m = JSON.parse(raw);
    return m && typeof m.at === 'string' ? m : null;
  } catch { return null; }
}

/*
 * Recorded for a FULL archive only. A ranged archive is one year's
 * substantiation, not a backup, and marking it as one would tell the user their
 * receipts are safe when nine months of them are not in any file.
 *
 * Written after the share sheet closes, which is the most we can honestly know:
 * iOS does not tell us where the file went, or whether the user cancelled. The
 * copy this feeds says "archive made", never "backed up", for exactly that
 * reason.
 */
export async function markFullArchive(receipts: Receipt[]): Promise<void> {
  let newest: string | null = null;
  for (const r of receipts) {
    if (r.createdAt && (newest === null || r.createdAt > newest)) newest = r.createdAt;
  }
  const mark: ArchiveMark = { at: new Date().toISOString(), newest, count: receipts.length };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(mark)); } catch {}
}
