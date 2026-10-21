import { db } from "./connection";

export function seed() {
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
}
