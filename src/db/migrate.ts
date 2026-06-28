import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "migrations.sql"), "utf8");

await pool.query(sql);
console.log("✓ migrations applied");
await pool.end();
