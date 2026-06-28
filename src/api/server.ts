import Fastify from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { PROVIDERS, type Provider } from "../core/canonical";
import { buildRegistry } from "../core/registry";
import { runReplay } from "../core/replay";
import { ingest } from "../db/ingest";
import { buildInspection } from "./inspect";
import {
  listAlerts,
  loadCorpus,
  metrics,
  providerHealth,
  recentEvents,
  vitals,
} from "../db/queries";

// The API exposes the full registry (openai v1 + v2) so the replay matrix and
// provider-health panels reflect the post-rollout world the seed leaves behind.
const registry = buildRegistry({ openaiV2: true });

const app = Fastify({ logger: false });

// Register Swagger OpenAPI schema generator and UI
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Oximy API Docs",
      description: "API Documentation for Oximy AI Observability Dashboard",
      version: "0.1.0",
    },
    servers: [{ url: "http://localhost:3001" }],
  },
});

await app.register(fastifySwaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: false,
  },
});

app.addHook("onSend", async (_req, reply) => {
  reply.header("access-control-allow-origin", "*");
});

app.get("/health", {
  schema: {
    description: "API Health status check",
    response: {
      200: {
        type: "object",
        properties: {
          ok: { type: "boolean" }
        }
      }
    }
  }
}, async () => ({ ok: true }));

app.post("/ingest", {
  schema: {
    description: "Ingest a new raw payload for a provider",
    body: {
      type: "object",
      required: ["provider", "payload"],
      properties: {
        provider: { type: "string", enum: PROVIDERS, description: "AI Provider name" },
        version: { type: "integer", description: "Optional parser version override" },
        payload: { type: "object", description: "The raw payload JSON from the provider" }
      }
    }
  }
}, async (req, reply) => {
  const body = req.body as { provider?: string; version?: number; payload?: unknown };
  if (!body?.provider || !PROVIDERS.includes(body.provider as Provider)) {
    return reply.code(400).send({ error: "provider must be one of " + PROVIDERS.join(", ") });
  }
  if (body.payload === undefined) {
    return reply.code(400).send({ error: "payload is required" });
  }
  try {
    const result = await ingest(body.provider as Provider, body.payload, registry, {
      version: body.version,
    });
    return result;
  } catch (e) {
    return reply.code(422).send({ error: (e as Error).message });
  }
});

app.get("/events", {
  schema: {
    description: "List recent canonical events",
    querystring: {
      type: "object",
      properties: {
        limit: { type: "integer", default: 50, description: "Maximum number of events to return" }
      }
    }
  }
}, async (req) => {
  const limit = Number((req.query as { limit?: number }).limit ?? 50);
  return recentEvents(Number.isFinite(limit) ? limit : 50);
});

app.get("/alerts", {
  schema: {
    description: "Retrieve all logged drift alerts"
  }
}, async () => listAlerts());

app.get("/providers", {
  schema: {
    description: "Retrieve health and version metadata for each provider"
  }
}, async () => {
  const rows = await providerHealth();
  // "parser version live" = what the registry would parse with now, alongside
  // the version that actually produced the stored events.
  return rows.map((r) => ({
    ...r,
    registered_versions: registry.versions(r.provider),
    live_version: registry.latest(r.provider)?.version ?? r.parser_version,
  }));
});

app.get("/metrics", {
  schema: {
    description: "Retrieve weekly spend metrics and cost integrity stats"
  }
}, async () => metrics());

app.get("/vitals", {
  schema: {
    description: "Retrieve field population vitals data for the dashboard charts"
  }
}, async () => vitals());

// Full single-event lifecycle for the Event Inspection page. Resolves the
// target event from an eventId, an alertId, or a provider.
app.get("/inspect", {
  schema: {
    description: "For forensic reconstruction of a single event's lifecycle",
    querystring: {
      type: "object",
      properties: {
        eventId: { type: "string", description: "Search by stable event UUID" },
        alertId: { type: "integer", description: "Search by drift alert ID" },
        provider: { type: "string", enum: PROVIDERS, description: "Filter or search by provider name" }
      }
    }
  }
}, async (req, reply) => {
  const q = req.query as { eventId?: string; alertId?: number; provider?: string };
  const result = await buildInspection(
    {
      eventId: q.eventId,
      alertId: q.alertId ? Number(q.alertId) : undefined,
      provider: q.provider,
    },
    registry,
  );
  if (!result) return reply.code(404).send({ error: "no matching event found" });
  return result;
});

// GET and POST both recompute the matrix on demand (the dashboard's "run replay").
app.get("/replay", {
  schema: {
    description: "Recompute the regression replay matrix on demand"
  }
}, replayHandler);

app.post("/replay", {
  schema: {
    description: "Recompute the regression replay matrix on demand"
  }
}, replayHandler);

async function replayHandler() {
  const corpus = await loadCorpus();
  const cells = runReplay(registry, corpus);
  return { cells, corpus_size: corpus.length, ran_at: new Date().toISOString() };
}

const port = Number(process.env.PORT ?? 3001);
app
  .listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`✓ oximy api on http://localhost:${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
