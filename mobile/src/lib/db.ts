// SQLite persistence. All data stays on-device: receipts rows + JPEG files
// under the app's documents directory.
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { RECEIPTS_DIR } from './images';
const C = require('./classifier.js');

export interface Allocation {
  category: string;
  scheduleC: string;
  amount: number;
  base?: number;
  tax?: number;
}

export interface Receipt {
  id?: number;
  createdAt: string;
  merchant: string;
  date: string; // ISO yyyy-mm-dd
  total: number;
  category: string;
  scheduleC: string;
  notes: string;
  salesTax: number | null;
  taxRate: number | null;
  allocations: Allocation[];
  confidence: string;
  ocrText: string;
  imagePath: string | null;
  thumbPath: string | null;
  // The classifier's own output, frozen at scan time, as JSON. null on rows
  // scanned before this existed — which means "unknown", not "unedited".
  // See edited.js.
  parsedSnapshot?: string | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('receiptsnap.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS receipts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          createdAt TEXT NOT NULL,
          merchant TEXT NOT NULL,
          date TEXT NOT NULL,
          total REAL NOT NULL,
          category TEXT NOT NULL,
          scheduleC TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          salesTax REAL,
          taxRate REAL,
          allocations TEXT NOT NULL DEFAULT '[]',
          confidence TEXT NOT NULL DEFAULT 'low',
          ocrText TEXT NOT NULL DEFAULT '',
          imagePath TEXT,
          thumbPath TEXT
        );
      `);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

/**
 * Data migrations, tracked by SQLite's own `user_version`.
 *
 * There was no migration mechanism before this — the schema was a single
 * CREATE TABLE IF NOT EXISTS, which is fine until the first time stored *data*
 * has to change. Renaming a category is exactly that: the name is a string on
 * every receipt row and inside every allocation.
 *
 * Each migration is idempotent and runs inside a transaction, so a crash
 * halfway through leaves the version unbumped and the data untouched — the
 * next launch simply runs it again.
 */
const MIGRATIONS: ((db: SQLite.SQLiteDatabase) => Promise<void>)[] = [
  // 1 — "Meals & Entertainment" became "Business Meals" (D-050).
  async (db) => {
    for (const [from, to] of Object.entries(C.CATEGORY_ALIASES as Record<string, string>)) {
      await db.runAsync('UPDATE receipts SET category = ? WHERE category = ?', to, from);
      // Allocations are a JSON array in a TEXT column. The category is the only
      // place the old name can appear inside it, and it is always a quoted JSON
      // string value, so replacing the quoted form cannot touch an amount or a
      // Schedule C label that merely mentions the same words.
      await db.runAsync(
        'UPDATE receipts SET allocations = REPLACE(allocations, ?, ?) WHERE allocations LIKE ?',
        JSON.stringify(from), JSON.stringify(to), '%' + from + '%'
      );
    }
    // Refresh the stored Schedule C label to whatever the category says today.
    // These are display strings copied at save time, so they go stale on any
    // wording change — and a CPA reading "Line 27a" against a current return
    // is being sent to the wrong box (D-046).
    for (const cat of C.CATEGORIES as { name: string; scheduleC: string }[]) {
      if (!cat.scheduleC) continue;
      await db.runAsync(
        'UPDATE receipts SET scheduleC = ? WHERE category = ? AND scheduleC <> ?',
        cat.scheduleC, cat.name, cat.scheduleC
      );
    }
  },

  // 2 — freeze what the classifier said, so a user correction becomes evidence.
  //
  // Nullable and unbackfillable on purpose: rows scanned before this column
  // existed have no parser output to compare against, and NULL says exactly
  // that. Writing a snapshot from the current values would assert the parser
  // got them right, which is the one thing we do not know — and it would
  // silently inflate every future accuracy measurement (D-056).
  async (db) => {
    const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(receipts)');
    if (!cols.some((c) => c.name === 'parsedSnapshot')) {
      await db.execAsync('ALTER TABLE receipts ADD COLUMN parsedSnapshot TEXT');
    }
  },

];

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await MIGRATIONS[version](db);
    });
    // PRAGMA does not accept a bound parameter, and `next` is a loop counter,
    // never user input.
    await db.execAsync(`PRAGMA user_version = ${next}`);
    version = next;
  }
}

function rowToReceipt(r: any): Receipt {
  let allocations: Allocation[] = [];
  try { allocations = JSON.parse(r.allocations || '[]'); } catch {}
  return { ...r, allocations, salesTax: r.salesTax ?? null, taxRate: r.taxRate ?? null };
}

export async function addReceipt(r: Receipt): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO receipts (createdAt, merchant, date, total, category, scheduleC, notes, salesTax, taxRate, allocations, confidence, ocrText, imagePath, thumbPath, parsedSnapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.createdAt, r.merchant, r.date, r.total, r.category, r.scheduleC, r.notes,
    r.salesTax, r.taxRate, JSON.stringify(r.allocations || []), r.confidence,
    r.ocrText, r.imagePath, r.thumbPath, r.parsedSnapshot ?? null
  );
  return res.lastInsertRowId;
}

export async function updateReceipt(r: Receipt): Promise<void> {
  if (r.id == null) throw new Error('updateReceipt: missing id');
  const db = await getDb();
  await db.runAsync(
    `UPDATE receipts SET merchant=?, date=?, total=?, category=?, scheduleC=?, notes=?, salesTax=?, taxRate=?, allocations=? WHERE id=?`,
    r.merchant, r.date, r.total, r.category, r.scheduleC, r.notes,
    r.salesTax, r.taxRate, JSON.stringify(r.allocations || []), r.id
  );
}

export async function deleteReceipt(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM receipts WHERE id=?', id);
}

/**
 * Delete everything — every row and every receipt photograph.
 *
 * Returns what it removed so the confirmation can say so; a "Deleted." toast
 * that names no number is indistinguishable from a no-op.
 *
 * The images matter as much as the rows. Deleting rows alone would leave every
 * photograph sitting in the documents directory while the app told the user
 * their data was gone — for an app whose entire claim is "it never leaves your
 * phone", being wrong about deletion is the worst available failure.
 *
 * Rows go first. If the directory removal then fails, the user is left with
 * orphaned image files and no rows, which is recoverable and invisible; the
 * reverse — rows pointing at images that are gone — shows up as broken
 * thumbnails in a tax record.
 */
export async function deleteAllData(): Promise<{ receipts: number; imagesRemoved: boolean }> {
  const db = await getDb();
  const before = await countAll();
  await db.runAsync('DELETE FROM receipts');

  let imagesRemoved = false;
  try {
    // RECEIPTS_DIR is null only where there is no documents directory at all,
    // so there are no photographs and "removed" is the accurate answer. It must
    // never become a path built from the string "null". Throwing here would
    // tell the user image files survived a Delete All, on the one screen where
    // being wrong about deletion matters most.
    if (RECEIPTS_DIR) {
      const info = await FileSystem.getInfoAsync(RECEIPTS_DIR);
      if (info.exists) await FileSystem.deleteAsync(RECEIPTS_DIR, { idempotent: true });
    }
    imagesRemoved = true;
  } catch (e) {
    console.warn('deleteAllData: image directory not removed', e);
  }
  return { receipts: before, imagesRemoved };
}

export async function allReceipts(): Promise<Receipt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM receipts ORDER BY date DESC, id DESC');
  return rows.map(rowToReceipt);
}

// Lifetime scans — the review prompt keys off this, not the monthly count,
// so it cannot re-fire every month (see gates.js / shouldAskForReview).
export async function countAll(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM receipts');
  return row?.n ?? 0;
}

// Scans this calendar month — the free-tier gate.
export async function countThisMonth(): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM receipts WHERE substr(createdAt, 1, 7) = ?", prefix
  );
  return row?.n ?? 0;
}
