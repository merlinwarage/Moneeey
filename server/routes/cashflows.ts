import type { Express } from "express";
import { db } from "../db/connection";
import { numOr, flag } from "../utils/coerce";

const cfArgs = (x: any) => [
  x.kind, x.name, numOr(x.amount, 0), flag(x.recurring), x.interval || "monthly", x.startDate, x.note || "", x.category || "",
];

export function registerCashflowRoutes(app: Express) {
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
}
