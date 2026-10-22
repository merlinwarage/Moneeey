import type { Express } from "express";
import { db } from "../db/connection";
import { numOr } from "../utils/coerce";

export function registerSettingsRoutes(app: Express) {
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
      "UPDATE settings SET theme=?, displayCurrency=?, eurHufRate=?, incomeGrowth=?, expenseGrowth=?, assetGrowth=?, inflation=?, interestTax=?, bondMarketRate=? WHERE id=1",
    ).run(
      b.theme || "dark",
      b.displayCurrency === "EUR" ? "EUR" : "HUF",
      rate > 0 ? rate : 355.28,
      numOr(b.incomeGrowth, 3),
      numOr(b.expenseGrowth, 2),
      numOr(b.assetGrowth, 6),
      numOr(b.inflation, 3.5),
      Math.min(100, Math.max(0, numOr(b.interestTax, 0))),
	  numOr(b.bondMarketRate, 99),
    );
    res.json(db.prepare("SELECT * FROM settings WHERE id=1").get());
  });
}
