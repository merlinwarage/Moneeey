import type { Express } from "express";
import { db } from "../db/connection";
import { numOr, flag } from "../utils/coerce";

const bondArgs = (x: any) => [
  x.type, x.series, numOr(x.principal, 0), numOr(x.annualRate, 0), x.purchaseDate, x.maturityDate,
  flag(x.reinvestInterest), numOr(x.reinvestRate, 0), x.couponFrequency || "quarterly", x.notes || "", flag(x.liquid), String(x.rateSteps || ""),
];

export function registerBondRoutes(app: Express) {
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
}
