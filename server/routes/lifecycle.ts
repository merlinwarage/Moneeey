import type { Express } from "express";

export function registerLifecycleRoutes(app: Express) {
  let quitTimer: ReturnType<typeof setTimeout> | null = null;
  app.get("/api/ping", (_req, res) => {
    if (quitTimer) { clearTimeout(quitTimer); quitTimer = null; }
    res.json({ ok: true });
  });
  app.post("/api/quit", (_req, res) => {
    res.end();
    if (!quitTimer) quitTimer = setTimeout(() => process.exit(0), 3000);
  });
}
