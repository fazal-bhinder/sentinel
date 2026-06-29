import { Hono } from "hono";
import { cors } from "hono/cors";
import { PROVIDERS, type Provider } from "../core/canonical";
import { buildRegistry } from "../core/registry";
import { runReplay } from "../core/replay";
import { ingest } from "../db/ingest";
import { initPool } from "../db/pool";
import { buildInspection } from "./inspect";
import {
  listAlerts,
  loadCorpus,
  metrics,
  providerHealth,
  recentEvents,
  vitals,
} from "../db/queries";

const app = new Hono<{ Bindings: { HYPERDRIVE: any; DATABASE_URL?: string } }>();

// Enable CORS
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Initialize database pool middleware on each request
app.use("*", async (c, next) => {
  initPool(c.env);
  await next();
});

const registry = buildRegistry({ openaiV2: true });

app.get("/health", (c) => c.json({ ok: true }));

app.post("/ingest", async (c) => {
  try {
    const body = await c.req.json() as { provider?: string; version?: number; payload?: unknown };
    if (!body?.provider || !PROVIDERS.includes(body.provider as Provider)) {
      return c.json({ error: "provider must be one of " + PROVIDERS.join(", ") }, 400);
    }
    if (body.payload === undefined) {
      return c.json({ error: "payload is required" }, 400);
    }
    const result = await ingest(body.provider as Provider, body.payload, registry, {
      version: body.version,
    });
    return c.json(result);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 422);
  }
});

app.get("/events", async (c) => {
  const limitQuery = c.req.query("limit");
  const limit = limitQuery ? Number(limitQuery) : 50;
  const events = await recentEvents(Number.isFinite(limit) ? limit : 50);
  return c.json(events);
});

app.get("/alerts", async (c) => {
  const alerts = await listAlerts();
  return c.json(alerts);
});

app.get("/providers", async (c) => {
  const rows = await providerHealth();
  const data = rows.map((r:any) => ({
    ...r,
    registered_versions: registry.versions(r.provider),
    live_version: registry.latest(r.provider)?.version ?? r.parser_version,
  }));
  return c.json(data);
});

app.get("/metrics", async (c) => {
  const data = await metrics();
  return c.json(data);
});

app.get("/vitals", async (c) => {
  const data = await vitals();
  return c.json(data);
});

app.get("/inspect", async (c) => {
  const eventId = c.req.query("eventId");
  const alertIdQuery = c.req.query("alertId");
  const alertId = alertIdQuery ? Number(alertIdQuery) : undefined;
  const provider = c.req.query("provider");

  const result = await buildInspection(
    {
      eventId,
      alertId,
      provider,
    },
    registry,
  );
  if (!result) return c.json({ error: "no matching event found" }, 404);
  return c.json(result);
});

const replayHandler = async (c:any) => {
  const corpus = await loadCorpus();
  const cells = runReplay(registry, corpus);
  return c.json({ cells, corpus_size: corpus.length, ran_at: new Date().toISOString() });
};

app.get("/replay", replayHandler);
app.post("/replay", replayHandler);

export default app;
