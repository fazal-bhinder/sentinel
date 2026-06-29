import pg from "pg";

let activePool: pg.Pool | null = null;

export function getConnectionString(env?: any): string {
  if (env?.HYPERDRIVE?.connectionString) {
    return env.HYPERDRIVE.connectionString;
  }
  if (env?.DATABASE_URL) {
    return env.DATABASE_URL;
  }
  return (
    process.env.DATABASE_URL ?? "postgres://oximy:oximy@localhost:5433/oximy"
  );
}

export function initPool(env?: any) {
  if (activePool) return activePool;
  const connectionString = getConnectionString(env);
  activePool = new pg.Pool({ connectionString });
  return activePool;
}

// Export a proxy object that delegates all calls to the active pool
export const pool = new Proxy({} as any, {
  get(target, prop) {
    const p = activePool || initPool();
    const value = (p as any)[prop];
    if (typeof value === "function") {
      return value.bind(p);
    }
    return value;
  },
});
