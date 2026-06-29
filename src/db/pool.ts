import pg from "pg";

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

// A custom Pool implementation that creates a fresh Client for every query/connection
// to prevent any open sockets or event loop hangs in serverless environments.
class ServerlessPool {
  private env: any;

  constructor(env?: any) {
    this.env = env;
  }

  async query(text: string, params?: any[]) {
    const client = new pg.Client({ connectionString: getConnectionString(this.env) });
    await client.connect();
    try {
      return await client.query(text, params);
    } finally {
      await client.end();
    }
  }

  async connect() {
    const client = new pg.Client({ connectionString: getConnectionString(this.env) });
    await client.connect();
    // Return a client that emulates a pool client with a release() method
    (client as any).release = async () => {
      await client.end();
    };
    return client;
  }
}

let activePool: ServerlessPool | null = null;

export function initPool(env?: any) {
  if (activePool) return activePool;
  activePool = new ServerlessPool(env);
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
