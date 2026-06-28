import type { CanonicalEvent } from "../core/canonical";
import { fingerprintPaths } from "../core/fingerprint";
import type { Registry } from "../core/registry";
import { type CorpusItem, runReplay } from "../core/replay";
import { pool } from "../db/pool";
import { loadCorpus } from "../db/queries";

/**
 * Reconstructs the complete lifecycle of a single event by reusing the core
 * (fingerprint, replay, registry) and the stored raw payload + golden. One
 * endpoint backs the whole Event Inspection page so the frontend stays
 * presentational and no business logic is duplicated.
 */

const FIELD_TO_COLUMN: Record<string, string> = {
  model: "model",
  "actor.raw_user_id": "raw_user_id",
  "usage.input_tokens": "input_tokens",
  "usage.output_tokens": "output_tokens",
  "cost.amount_usd": "cost_amount_usd",
};
const THRESHOLD = 0.9;
const RECENT = 20;

export type EventStatus = "Healthy" | "Drift" | "Silent Null" | "Replay Failed";

export interface Inspection {
  status: EventStatus;
  event: CanonicalEvent;
  raw_payload: unknown;
  raw_payload_id: string;
  received_at: string;
  parser: {
    provider: string;
    version: number;
    expects: string[];
    populated: string[];
    missing: string[];
  };
  canonical: Record<string, unknown>;
  null_paths: string[];
  structural_diff: {
    changed: boolean;
    baseline_paths: string[];
    current_paths: string[];
    added: string[];
    removed: string[];
  };
  silent_null: {
    field: string;
    historical_rate: number;
    recent_rate: number;
    threshold: number;
    status: "CRITICAL" | "WARN";
    series: number[];
  } | null;
  replay: {
    status: "passed" | "failed";
    historical: number;
    regressions: number;
    failures: { payload: number; version: number; expected: unknown; actual: unknown; reason: string }[];
  };
  timeline: { stage: string; status: "ok" | "warn" | "fail"; detail: string; at: string | null }[];
  notes: { root_cause: string; impact: string; suggested_fix: string; replay: string };
  related_alerts: AlertRow[];
}

interface EventRow {
  event_id: string;
  dedup_key: string;
  provider: string;
  parser_version: number;
  raw_payload_id: string;
  occurred_at: string;
  event_type: string;
  model: string | null;
  raw_user_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_amount_usd: number | null;
  revision: number;
  ingested_at: string;
}

interface AlertRow {
  id: number;
  provider: string;
  type: "STRUCTURAL" | "SILENT_NULL";
  severity: "warn" | "critical";
  field: string | null;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as any)[k]), obj);
}

function canonicalFromRow(e: EventRow): Record<string, unknown> {
  return {
    event_id: e.event_id,
    dedup_key: e.dedup_key,
    provider: e.provider,
    parser_version: e.parser_version,
    occurred_at: e.occurred_at,
    event_type: e.event_type,
    model: e.model,
    actor: { raw_user_id: e.raw_user_id },
    usage: { input_tokens: e.input_tokens, output_tokens: e.output_tokens },
    cost: { amount_usd: e.cost_amount_usd == null ? null : Number(e.cost_amount_usd) },
    revision: e.revision,
    ingested_at: e.ingested_at,
  };
}

/* ------------------------------------------------------------------ */
/* Resolve which event to inspect                                      */
/* ------------------------------------------------------------------ */

async function resolveEventId(params: {
  eventId?: string;
  alertId?: number;
  provider?: string;
}): Promise<string | null> {
  if (params.eventId) return params.eventId;

  if (params.alertId != null) {
    const a = await pool.query<AlertRow>(`SELECT * FROM drift_alerts WHERE id = $1`, [params.alertId]);
    const alert = a.rows[0];
    if (!alert) return null;

    if (alert.type === "SILENT_NULL" && alert.field) {
      const col = FIELD_TO_COLUMN[alert.field];
      if (col) {
        const r = await pool.query<{ event_id: string }>(
          `SELECT event_id FROM events WHERE provider = $1 AND ${col} IS NULL
            ORDER BY ingested_at DESC LIMIT 1`,
          [alert.provider],
        );
        if (r.rows[0]) return r.rows[0].event_id;
      }
    }
    if (alert.type === "STRUCTURAL") {
      const fp = String(alert.details?.fingerprint ?? "");
      const r = await pool.query<{ event_id: string }>(
        `SELECT e.event_id FROM events e
           JOIN raw_payloads rp ON rp.id = e.raw_payload_id
          WHERE e.provider = $1 AND rp.fingerprint = $2
          ORDER BY e.ingested_at DESC LIMIT 1`,
        [alert.provider, fp],
      );
      if (r.rows[0]) return r.rows[0].event_id;
    }
    // Fall back to the provider's latest problematic event.
    return resolveEventId({ provider: alert.provider });
  }

  if (params.provider) {
    const dark = await pool.query<{ event_id: string }>(
      `SELECT event_id FROM events WHERE provider = $1 AND cost_amount_usd IS NULL
        ORDER BY ingested_at DESC LIMIT 1`,
      [params.provider],
    );
    if (dark.rows[0]) return dark.rows[0].event_id;
    const any = await pool.query<{ event_id: string }>(
      `SELECT event_id FROM events WHERE provider = $1 ORDER BY ingested_at DESC LIMIT 1`,
      [params.provider],
    );
    return any.rows[0]?.event_id ?? null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Build the inspection                                                */
/* ------------------------------------------------------------------ */

export async function buildInspection(
  params: { eventId?: string; alertId?: number; provider?: string },
  registry: Registry,
): Promise<Inspection | null> {
  const eventId = await resolveEventId(params);
  if (!eventId) return null;

  const ev = await pool.query<EventRow>(`SELECT * FROM events WHERE event_id = $1`, [eventId]);
  const event = ev.rows[0];
  if (!event) return null;

  const rp = await pool.query<{ payload: unknown; fingerprint: string; received_at: string }>(
    `SELECT payload, fingerprint, received_at FROM raw_payloads WHERE id = $1`,
    [event.raw_payload_id],
  );
  const raw = rp.rows[0];

  const parser = registry.get(event.provider, event.parser_version);
  const expects = parser?.expects ?? [];
  const canonical = canonicalFromRow(event);
  const populated = expects.filter((p) => getByPath(canonical, p) != null);
  const missing = expects.filter((p) => getByPath(canonical, p) == null);
  const nullPaths = missing.map((m) => m);

  // ---- structural diff vs the provider's dominant (clean) shape ----
  const dom = await pool.query<{ fingerprint: string }>(
    `SELECT fingerprint FROM raw_payloads WHERE provider = $1
      GROUP BY fingerprint ORDER BY count(*) DESC LIMIT 1`,
    [event.provider],
  );
  const baselinePaths = new Set((dom.rows[0]?.fingerprint ?? "").split("\n").filter(Boolean));
  const currentPaths = raw ? fingerprintPaths(raw.payload) : new Set<string>();
  const added = [...currentPaths].filter((p) => !baselinePaths.has(p)).sort();
  const removed = [...baselinePaths].filter((p) => !currentPaths.has(p)).sort();

  // ---- silent-null analysis (live, mirrors the drift detector) ----
  let silentNull: Inspection["silent_null"] = null;
  const darkField = missing.find((m) => FIELD_TO_COLUMN[m]);
  if (darkField) {
    const col = FIELD_TO_COLUMN[darkField]!;
    const totals = await pool.query<{ seen: number; pop: number }>(
      `SELECT count(*)::int AS seen, count(${col})::int AS pop FROM events WHERE provider = $1`,
      [event.provider],
    );
    const recent = await pool.query<{ seen: number; pop: number }>(
      `SELECT count(*)::int AS seen, count(${col})::int AS pop
         FROM (SELECT * FROM events WHERE provider = $1 ORDER BY ingested_at DESC, event_id LIMIT ${RECENT}) t`,
      [event.provider],
    );
    const t = totals.rows[0]!;
    const r = recent.rows[0]!;
    const baseSeen = t.seen - r.seen;
    const basePop = t.pop - r.pop;
    const historical = baseSeen > 0 ? basePop / baseSeen : 1;
    const recentRate = r.seen > 0 ? r.pop / r.seen : 1;
    const series = await fieldSeries(event.provider, col, 40);
    if (historical >= THRESHOLD && recentRate <= 1 - THRESHOLD + 0.0001) {
      silentNull = {
        field: darkField,
        historical_rate: historical,
        recent_rate: recentRate,
        threshold: THRESHOLD,
        status: darkField === "cost.amount_usd" ? "CRITICAL" : "WARN",
        series,
      };
    }
  }

  // ---- replay for this provider (reuse runReplay) ----
  const corpus = await loadCorpus();
  const providerItems = corpus.filter((c) => c.provider === event.provider);
  const cells = runReplay(registry, corpus).filter((c) => c.provider === event.provider);
  const regressions = cells.reduce((s, c) => s + c.throw, 0);
  const failures = detailedFailures(registry, providerItems, event.provider);
  const replay = {
    status: (regressions > 0 ? "failed" : "passed") as "passed" | "failed",
    historical: providerItems.length,
    regressions,
    failures,
  };

  // ---- alerts related to this event ----
  const al = await pool.query<AlertRow>(
    `SELECT * FROM drift_alerts WHERE provider = $1 ORDER BY created_at DESC`,
    [event.provider],
  );
  const related = al.rows.filter(
    (a) =>
      (a.type === "SILENT_NULL" && missing.includes(a.field ?? "")) ||
      (a.type === "STRUCTURAL" && (added.length > 0 || removed.length > 0)),
  );

  // ---- suggested fix: a later parser version that fills a missing field ----
  let suggestedVersion: number | null = null;
  for (const v of registry.versions(event.provider).filter((v) => v > event.parser_version)) {
    if (!raw) break;
    const out = registry.get(event.provider, v)!.parse(raw.payload);
    if (missing.some((p) => getByPath(out, p) != null)) {
      suggestedVersion = v;
      break;
    }
  }

  const affected = await pool.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM events WHERE provider = $1 AND cost_amount_usd IS NULL`,
    [event.provider],
  );

  // ---- status badge ----
  const structuralChanged = added.length > 0 || removed.length > 0;
  let status: EventStatus = "Healthy";
  if (replay.status === "failed") status = "Replay Failed";
  else if (silentNull?.status === "CRITICAL") status = "Silent Null";
  else if (structuralChanged || silentNull) status = "Drift";

  // ---- timeline ----
  const timeline = buildTimeline(event, raw?.received_at ?? null, {
    missing,
    structuralChanged,
    silentNull: !!silentNull,
    silentCritical: silentNull?.status === "CRITICAL",
    deduped: event.revision > 1,
  });

  // ---- engineering notes ----
  const rootCause = structuralChanged
    ? `Provider moved a field: ${removed.length ? removed.join(", ") : "—"} → ${added.length ? added.join(", ") : "—"}.`
    : silentNull
      ? `${silentNull.field} stopped populating without a parse error.`
      : "No incident — every expected field is populating normally.";
  const impact = missing.length
    ? `${affected.rows[0]?.c ?? 0} ${event.provider} events currently missing ${missing.join(", ")}.`
    : "No fields missing on this event.";
  const suggestedFix = suggestedVersion
    ? `Upgrade to ${event.provider} parser v${suggestedVersion} (reads the moved field).`
    : "On the latest parser — no upgrade needed.";
  const replayNote =
    replay.regressions === 0
      ? `${replay.historical} historical ${event.provider} payloads validate successfully.`
      : `${replay.regressions} regression(s) across ${replay.historical} historical payloads.`;

  return {
    status,
    event: canonical as unknown as CanonicalEvent,
    raw_payload: raw?.payload ?? null,
    raw_payload_id: event.raw_payload_id,
    received_at: raw?.received_at ?? event.ingested_at,
    parser: { provider: event.provider, version: event.parser_version, expects, populated, missing },
    canonical,
    null_paths: nullPaths,
    structural_diff: {
      changed: structuralChanged,
      baseline_paths: [...baselinePaths].sort(),
      current_paths: [...currentPaths].sort(),
      added,
      removed,
    },
    silent_null: silentNull,
    replay,
    timeline,
    notes: { root_cause: rootCause, impact, suggested_fix: suggestedFix, replay: replayNote },
    related_alerts: related,
  };
}

async function fieldSeries(provider: string, col: string, window: number): Promise<number[]> {
  const res = await pool.query(
    `SELECT ${col} AS v FROM (SELECT ${col}, ingested_at, event_id FROM events
        WHERE provider = $1 ORDER BY ingested_at DESC, event_id LIMIT ${window}) t
      ORDER BY ingested_at ASC, event_id ASC`,
    [provider],
  );
  return res.rows.map((r) => (r.v === null ? 0 : 1));
}

function detailedFailures(registry: Registry, items: CorpusItem[], provider: string) {
  const failures: Inspection["replay"]["failures"] = [];
  for (const v of registry.versions(provider)) {
    const parser = registry.get(provider, v)!;
    items.forEach((it, idx) => {
      try {
        parser.parse(it.raw);
      } catch (e) {
        failures.push({
          payload: idx,
          version: v,
          expected: getByPath(it.golden, "cost.amount_usd"),
          actual: null,
          reason: (e as Error).message,
        });
      }
    });
  }
  return failures.slice(0, 8);
}

function buildTimeline(
  e: EventRow,
  receivedAt: string | null,
  flags: {
    missing: string[];
    structuralChanged: boolean;
    silentNull: boolean;
    silentCritical: boolean;
    deduped: boolean;
  },
): Inspection["timeline"] {
  const driftStatus: "ok" | "warn" | "fail" = flags.silentCritical
    ? "fail"
    : flags.structuralChanged || flags.silentNull
      ? "warn"
      : "ok";
  return [
    { stage: "Payload Received", status: "ok", detail: "Raw JSON accepted", at: receivedAt },
    { stage: "Provider Identified", status: "ok", detail: e.provider, at: receivedAt },
    { stage: "Parser Selected", status: "ok", detail: `${e.provider} v${e.parser_version}`, at: receivedAt },
    {
      stage: "Canonical Event Created",
      status: flags.missing.length ? "warn" : "ok",
      detail: flags.missing.length ? `${flags.missing.join(", ")} read null` : "All expected fields populated",
      at: e.occurred_at,
    },
    {
      stage: "Deduplicated",
      status: "ok",
      detail: flags.deduped ? `merged backfill → revision ${e.revision}` : "new dedup_key",
      at: e.ingested_at,
    },
    {
      stage: "Drift Detection",
      status: driftStatus,
      detail: flags.silentCritical
        ? "SILENT_NULL critical raised"
        : flags.structuralChanged
          ? "structural shape change"
          : "no drift",
      at: e.ingested_at,
    },
    { stage: "Stored", status: "ok", detail: `event ${e.event_id.slice(0, 8)}…`, at: e.ingested_at },
    { stage: "Dashboard Updated", status: "ok", detail: "metrics + alerts refreshed", at: e.ingested_at },
  ];
}
