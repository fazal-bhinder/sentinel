import pg from "pg";

// Shim setTimeout/setInterval to support Node-specific .unref()/.ref() methods inside V8 isolates
const shimTimer = (original: any) => {
  return function (cb: any, ms: any, ...args: any[]) {
    const timer = original(cb, ms, ...args);
    if (timer && typeof timer === "object" && !("unref" in timer)) {
      (timer as any).unref = () => timer;
      (timer as any).ref = () => timer;
    }
    return timer;
  };
};

if (typeof globalThis !== "undefined") {
  globalThis.setTimeout = shimTimer(globalThis.setTimeout) as any;
  globalThis.setInterval = shimTimer(globalThis.setInterval) as any;
}

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
  activePool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 100, // close idle connections after 100ms
    allowExitOnIdle: true,  // allow the event loop to exit if all connections are idle
  });
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
