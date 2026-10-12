import express from "express";
import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

//const dataDir = path.join(process.env.APPDATA || process.cwd(), "PenzugyiDashboard");
const dataDir = path.join(path.dirname(process.execPath), "data");
fs.mkdirSync(dataDir, { recursive: true });
const exeDir = path.dirname(process.execPath);
const publicDir = fs.existsSync(path.join(exeDir, "public"))
  ? path.join(exeDir, "public")
  : path.join(process.cwd(), "public");

const app = express();
const db = new Database(path.join(dataDir, "finance.db"));
app.use(express.json());
app.use(express.static(publicDir));

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

function ensureColumn(table: string, column: string, sql: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) db.exec(sql);
}

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

// A 0 is érvényes érték (pl. 0% infláció), ezért nem `||`-t használunk
const numOr = (v: unknown, d: number) => {
  const n = Number(v);
  return v !== undefined && v !== null && v !== "" && Number.isFinite(n) ? n : d;
};
const numOrNull = (v: unknown) => {
  const n = Number(v);
  return v !== undefined && v !== null && v !== "" && Number.isFinite(n) ? n : null;
};
const flag = (v: unknown) => (Number(v) ? 1 : 0);

if (!(db.prepare("SELECT COUNT(*) c FROM settings").get() as { c: number }).c) {
  db.prepare(
    "INSERT INTO settings (id, theme, displayCurrency, eurHufRate, incomeGrowth, expenseGrowth, assetGrowth, inflation, interestTax) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("dark", "HUF", 355.28, 3, 2, 6, 3.5, 0);
}

if (!(db.prepare("SELECT COUNT(*) c FROM cashflows").get() as { c: number }).c) {
  const ins = db.prepare(
    "INSERT INTO cashflows (kind,name,amount,recurring,interval,startDate,note,category,enabled) VALUES (?,?,?,?,?,?,?,?,1)",
  );
  ins.run("income", "Fizetés", 500000, 1, "monthly", "2025-06-05", "", "fizetes");
  ins.run("expense", "Általános", 100000, 1, "monthly", "2025-07-04", "", "altalanoskiadas");
}

if (!(db.prepare("SELECT COUNT(*) c FROM bonds").get() as { c: number }).c) {
  db.prepare(
    "INSERT INTO bonds (type,series,principal,annualRate,purchaseDate,maturityDate,reinvestInterest,reinvestRate,couponFrequency,notes,liquid,rateSteps,enabled) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)",
  ).run("Fix Magyar Állampapír", "2031/Q2", 1000000, 6.5, "2026-05-21", "2031-04-23", 1, 5.5, "quarterly", "", 0, "");
}

if (!(db.prepare("SELECT COUNT(*) c FROM assets").get() as { c: number }).c) {
  const ins = db.prepare("INSERT INTO assets (name,category,amount,currency,note) VALUES (?,?,?,?,?)");
  ins.run("Takarék", "bank", 200000, "HUF", "Bankszámla");
  ins.run("Vésztartalék", "cash", 350000, "HUF", "");
}

// ---- app lifecycle (desktop window) ----
let quitTimer: ReturnType<typeof setTimeout> | null = null;
app.get("/api/ping", (_req, res) => {
  if (quitTimer) { clearTimeout(quitTimer); quitTimer = null; }
  res.json({ ok: true });
});
app.post("/api/quit", (_req, res) => {
  res.end();
  if (!quitTimer) quitTimer = setTimeout(() => process.exit(0), 3000);
});

app.get("/api/bootstrap", (_req, res) => {
  res.json({
    version: "full-v3",
    settings: db.prepare("SELECT * FROM settings WHERE id=1").get(),
    cashflows: db.prepare("SELECT * FROM cashflows ORDER BY id DESC").all(),
    bonds: db.prepare("SELECT * FROM bonds ORDER BY id DESC").all(),
    assets: db.prepare("SELECT * FROM assets ORDER BY id DESC").all(),
  });
});

app.post("/api/settings", (req, res) => {
  const b = req.body || {};
  const rate = numOr(b.eurHufRate, 355.28);
  db.prepare(
    "UPDATE settings SET theme=?, displayCurrency=?, eurHufRate=?, incomeGrowth=?, expenseGrowth=?, assetGrowth=?, inflation=?, interestTax=? WHERE id=1",
  ).run(
    b.theme || "dark",
    b.displayCurrency === "EUR" ? "EUR" : "HUF",
    rate > 0 ? rate : 355.28,
    numOr(b.incomeGrowth, 3),
    numOr(b.expenseGrowth, 2),
    numOr(b.assetGrowth, 6),
    numOr(b.inflation, 3.5),
    Math.min(100, Math.max(0, numOr(b.interestTax, 0))),
  );
  res.json(db.prepare("SELECT * FROM settings WHERE id=1").get());
});

// ---- cashflows ----
const cfArgs = (x: any) => [
  x.kind, x.name, numOr(x.amount, 0), flag(x.recurring), x.interval || "monthly", x.startDate, x.note || "", x.category || "",
];
app.post("/api/cashflows", (req, res) => {
  const r = db
    .prepare("INSERT INTO cashflows (kind,name,amount,recurring,interval,startDate,note,category,enabled) VALUES (?,?,?,?,?,?,?,?,1)")
    .run(...(cfArgs(req.body) as any[]));
  res.json(db.prepare("SELECT * FROM cashflows WHERE id=?").get(Number(r.lastInsertRowid)));
});
app.put("/api/cashflows/:id", (req, res) => {
  db.prepare("UPDATE cashflows SET kind=?, name=?, amount=?, recurring=?, interval=?, startDate=?, note=?, category=? WHERE id=?").run(
    ...(cfArgs(req.body) as any[]), req.params.id,
  );
  res.json(db.prepare("SELECT * FROM cashflows WHERE id=?").get(req.params.id));
});
app.delete("/api/cashflows/:id", (req, res) => {
  db.prepare("DELETE FROM cashflows WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ---- bonds ----
const bondArgs = (x: any) => [
  x.type, x.series, numOr(x.principal, 0), numOr(x.annualRate, 0), x.purchaseDate, x.maturityDate,
  flag(x.reinvestInterest), numOr(x.reinvestRate, 0), x.couponFrequency || "quarterly", x.notes || "", flag(x.liquid), String(x.rateSteps || ""),
];
app.post("/api/bonds", (req, res) => {
  const r = db
    .prepare("INSERT INTO bonds (type,series,principal,annualRate,purchaseDate,maturityDate,reinvestInterest,reinvestRate,couponFrequency,notes,liquid,rateSteps,enabled) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)")
    .run(...(bondArgs(req.body) as any[]));
  res.json(db.prepare("SELECT * FROM bonds WHERE id=?").get(Number(r.lastInsertRowid)));
});
app.put("/api/bonds/:id", (req, res) => {
  db.prepare("UPDATE bonds SET type=?, series=?, principal=?, annualRate=?, purchaseDate=?, maturityDate=?, reinvestInterest=?, reinvestRate=?, couponFrequency=?, notes=?, liquid=?, rateSteps=? WHERE id=?").run(
    ...(bondArgs(req.body) as any[]), req.params.id,
  );
  res.json(db.prepare("SELECT * FROM bonds WHERE id=?").get(req.params.id));
});
app.delete("/api/bonds/:id", (req, res) => {
  db.prepare("DELETE FROM bonds WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ---- assets ----
const assetArgs = (x: any) => [
  x.name, x.category, numOr(x.amount, 0), x.currency === "EUR" ? "EUR" : "HUF", x.note || "", numOrNull(x.quantity), numOrNull(x.price),
];
app.post("/api/assets", (req, res) => {
  const r = db.prepare("INSERT INTO assets (name,category,amount,currency,note,quantity,price) VALUES (?,?,?,?,?,?,?)").run(...(assetArgs(req.body) as any[]));
  res.json(db.prepare("SELECT * FROM assets WHERE id=?").get(Number(r.lastInsertRowid)));
});
app.put("/api/assets/:id", (req, res) => {
  db.prepare("UPDATE assets SET name=?, category=?, amount=?, currency=?, note=?, quantity=?, price=? WHERE id=?").run(...(assetArgs(req.body) as any[]), req.params.id);
  res.json(db.prepare("SELECT * FROM assets WHERE id=?").get(req.params.id));
});
app.delete("/api/assets/:id", (req, res) => {
  db.prepare("DELETE FROM assets WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

// ---- start server + open desktop window ----
const PORT = 3000;
app.listen(PORT, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PORT}`;
  console.log(url);
  const edge = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find(fs.existsSync);
  if (!edge) {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn(
    edge,
    [`--app=${url}`, `--user-data-dir=${path.join(dataDir, "edge-profile")}`, "--no-first-run", "--window-size=1280,860"],
    { detached: true, stdio: "ignore" },
  ).unref();
});
