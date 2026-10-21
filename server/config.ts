import path from "path";
import fs from "fs";

//const dataDir = path.join(process.env.APPDATA || process.cwd(), "PenzugyiDashboard");
export const exeDir = path.dirname(process.execPath);
export const dataDir = path.join(exeDir, "data");
fs.mkdirSync(dataDir, { recursive: true });

export const publicDir = fs.existsSync(path.join(exeDir, "public"))
  ? path.join(exeDir, "public")
  : path.join(process.cwd(), "public");

export const PORT = 3000;
