import { Pool } from "pg";

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://oximy:oximy@localhost:5433/oximy",
});
