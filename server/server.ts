import express from "express";
import path from "path";
import { publicDir } from "./config";
import { createTables, migrate } from "./db/schema";
import { seed } from "./db/seed";
import { registerLifecycleRoutes } from "./routes/lifecycle";
import { registerSettingsRoutes } from "./routes/settings";
import { registerCashflowRoutes } from "./routes/cashflows";
import { registerBondRoutes } from "./routes/bonds";
import { registerAssetRoutes } from "./routes/assets";
import { startServer } from "./launcher";

createTables();
migrate();
seed();

const app = express();
app.use(express.json());
app.use(express.static(publicDir));

registerLifecycleRoutes(app);
registerSettingsRoutes(app);
registerCashflowRoutes(app);
registerBondRoutes(app);
registerAssetRoutes(app);

app.get("*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

startServer(app);
