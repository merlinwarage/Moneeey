import { Database } from "bun:sqlite";
import path from "path";
import { dataDir } from "../config";

export const db = new Database(path.join(dataDir, "finance.db"));
