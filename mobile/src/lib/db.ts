// SQLite persistence. All data stays on-device: receipts rows + JPEG files
// under the app's documents directory.
import * as SQLite from 'expo-sqlite';

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
      return db;
    })();
  }
  return dbPromise;
}

function rowToReceipt(r: any): Receipt {
  let allocations: Allocation[] = [];
  try { allocations = JSON.parse(r.allocations || '[]'); } catch {}
  return { ...r, allocations, salesTax: r.salesTax ?? null, taxRate: r.taxRate ?? null };
}

export async function addReceipt(r: Receipt): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    `INSERT INTO receipts (createdAt, merchant, date, total, category, scheduleC, notes, salesTax, taxRate, allocations, confidence, ocrText, imagePath, thumbPath)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.createdAt, r.merchant, r.date, r.total, r.category, r.scheduleC, r.notes,
    r.salesTax, r.taxRate, JSON.stringify(r.allocations || []), r.confidence,
    r.ocrText, r.imagePath, r.thumbPath
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
