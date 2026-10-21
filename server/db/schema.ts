import { db } from "./connection";

export function createTables() {
  db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  theme TEXT NOT NULL,
  displayCurrency TEXT NOT NULL,
  eurHufRate REAL NOT NULL,
  incomeGrowth REAL NOT NULL DEFAULT 3,
  expenseGrowth REAL NOT NULL DEFAULT 2,
  assetGrowth REAL NOT NULL DEFAULT 6,
  inflation REAL NOT NULL DEFAULT 3.5
  );
  CREATE TABLE IF NOT EXISTS cashflows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  recurring INTEGER NOT NULL,
  interval TEXT NOT NULL,
  startDate TEXT NOT NULL,
  note TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS bonds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  series TEXT NOT NULL,
  principal REAL NOT NULL,
  annualRate REAL NOT NULL,
  purchaseDate TEXT NOT NULL,
  maturityDate TEXT NOT NULL,
  reinvestInterest INTEGER NOT NULL DEFAULT 0,
  reinvestRate REAL NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  note TEXT DEFAULT ''
  );
  `);
}

function ensureColumn(table: string, column: string, sql: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) db.exec(sql);
}

export function migrate() {
  ensureColumn("cashflows", "note", "ALTER TABLE cashflows ADD COLUMN note TEXT DEFAULT '';");
  ensureColumn("cashflows", "category", "ALTER TABLE cashflows ADD COLUMN category TEXT DEFAULT '';");
  ensureColumn("bonds", "reinvestInterest", "ALTER TABLE bonds ADD COLUMN reinvestInterest INTEGER NOT NULL DEFAULT 0;");
  ensureColumn("bonds", "reinvestRate", "ALTER TABLE bonds ADD COLUMN reinvestRate REAL NOT NULL DEFAULT 0;");
  ensureColumn("bonds", "couponFrequency", "ALTER TABLE bonds ADD COLUMN couponFrequency TEXT NOT NULL DEFAULT 'quarterly';");
  ensureColumn("bonds", "notes", "ALTER TABLE bonds ADD COLUMN notes TEXT DEFAULT '';");
  ensureColumn("bonds", "liquid", "ALTER TABLE bonds ADD COLUMN liquid INTEGER NOT NULL DEFAULT 0;");
  ensureColumn("bonds", "rateSteps", "ALTER TABLE bonds ADD COLUMN rateSteps TEXT NOT NULL DEFAULT '';");
  ensureColumn("assets", "quantity", "ALTER TABLE assets ADD COLUMN quantity REAL;");
  ensureColumn("assets", "price", "ALTER TABLE assets ADD COLUMN price REAL;");
  ensureColumn("settings", "incomeGrowth", "ALTER TABLE settings ADD COLUMN incomeGrowth REAL NOT NULL DEFAULT 3;");
  ensureColumn("settings", "expenseGrowth", "ALTER TABLE settings ADD COLUMN expenseGrowth REAL NOT NULL DEFAULT 2;");
  ensureColumn("settings", "assetGrowth", "ALTER TABLE settings ADD COLUMN assetGrowth REAL NOT NULL DEFAULT 6;");
  ensureColumn("settings", "inflation", "ALTER TABLE settings ADD COLUMN inflation REAL NOT NULL DEFAULT 3.5;");
  ensureColumn("settings", "interestTax", "ALTER TABLE settings ADD COLUMN interestTax REAL NOT NULL DEFAULT 0;");
}
