import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import type { Express } from "express";
import { dataDir, PORT } from "./config";

export function startServer(app: Express) {
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
      [`--app=${url}`, `--user-data-dir=${path.join(dataDir, "edge-profile")}`, "--no-first-run", "--window-size=1366,928"],
      { detached: true, stdio: "ignore" },
    ).unref();
  });
}
