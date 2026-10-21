import type { Express } from "express";
import { db } from "../db/connection";
import { numOr, numOrNull } from "../utils/coerce";

const assetArgs = (x: any) => [
  x.name, x.category, numOr(x.amount, 0), x.currency === "EUR" ? "EUR" : "HUF", x.note || "", numOrNull(x.quantity), numOrNull(x.price),
];

export function registerAssetRoutes(app: Express) {
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
}
