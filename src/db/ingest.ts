import type { PoolClient } from "pg";
import type { CanonicalEvent, Provider } from "../core/canonical";
import { contentHash, deterministicUuid } from "../core/dedup";
import {
  type DriftAlert,
  type FieldStat,
  silentNullDrift,
  structuralDrift,
} from "../core/drift";
import { fingerprint } from "../core/fingerprint";
import type { Registry } from "../core/registry";
import { pool } from "./pool";

export interface IngestResult {
  inserted: boolean; // false on redelivery / backfill of an existing dedup_key
  revision: number;
  dedup_key: string;
  event_id: string;
  alerts: DriftAlert[];
}

/** Maps a parser's `expects` entries to the events columns we can measure. */
const FIELD_TO_COLUMN: Record<string, string> = {
  model: "model",
  "actor.raw_user_id": "raw_user_id",
  "usage.input_tokens": "input_tokens",
  "usage.output_tokens": "output_tokens",
  "cost.amount_usd": "cost_amount_usd",
};

const RECENT_WINDOW = 20;

/**
 * Ingest one raw payload for a provider. Parses with the registry (latest
 * version unless pinned), stores the raw payload + golden, upserts the canonical
 * event on dedup_key, then runs both drift modes and persists any alerts.
 */
export async function ingest(
  provider: Provider,
  raw: unknown,
  registry: Registry,
  opts: { version?: number } = {},
): Promise<IngestResult> {
  const parser = opts.version
    ? registry.get(provider, opts.version)
    : registry.latest(provider);
  if (!parser) throw new Error(`no parser registered for ${provider} v${opts.version ?? "?"}`);

  const golden = parser.parse(raw); // pure; throws here would surface as ingest failure
  const fp = fingerprint(raw);
  const cHash = contentHash(raw);
  const rawId = deterministicUuid(cHash);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Gather drift history BEFORE writing the current payload.
    const known = await knownFingerprints(client, provider);

    await client.query(
      `INSERT INTO raw_payloads (id, provider, content_hash, payload, fingerprint, parser_version, golden)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (content_hash) DO NOTHING`,
      [rawId, provider, cHash, JSON.stringify(raw), fp, parser.version, JSON.stringify(golden)],
    );

    const upsert = await upsertEvent(client, golden, rawId, parser.version);

    const alerts = await detectDrift(client, provider, raw, parser.expects, known);

    await client.query("COMMIT");
    return {
      inserted: upsert.inserted,
      revision: upsert.revision,
      dedup_key: golden.dedup_key,
      event_id: upsert.event_id,
      alerts,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function upsertEvent(
  client: PoolClient,
  ev: CanonicalEvent,
  rawId: string,
  version: number,
): Promise<{ inserted: boolean; revision: number; event_id: string }> {
  // ON CONFLICT: never touch identity fields. Fill nulls or take a more
  // authoritative cost/token value, and only bump revision when something
  // actually changed (so idempotent redelivery is a true no-op).
  const res = await client.query(
    `INSERT INTO events (
        event_id, dedup_key, provider, parser_version, raw_payload_id,
        occurred_at, event_type, model, raw_user_id,
        input_tokens, output_tokens, cost_amount_usd, revision)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1)
     ON CONFLICT (dedup_key) DO UPDATE SET
        input_tokens    = COALESCE(EXCLUDED.input_tokens,    events.input_tokens),
        output_tokens   = COALESCE(EXCLUDED.output_tokens,   events.output_tokens),
        cost_amount_usd = COALESCE(EXCLUDED.cost_amount_usd, events.cost_amount_usd),
        raw_payload_id  = EXCLUDED.raw_payload_id,
        parser_version  = EXCLUDED.parser_version,
        revision = events.revision + (
          CASE WHEN
               COALESCE(EXCLUDED.cost_amount_usd, events.cost_amount_usd) IS DISTINCT FROM events.cost_amount_usd
            OR COALESCE(EXCLUDED.input_tokens,    events.input_tokens)    IS DISTINCT FROM events.input_tokens
            OR COALESCE(EXCLUDED.output_tokens,   events.output_tokens)   IS DISTINCT FROM events.output_tokens
          THEN 1 ELSE 0 END)
     RETURNING (xmax = 0) AS inserted, revision, event_id`,
    [
      ev.event_id,
      ev.dedup_key,
      ev.provider,
      version,
      rawId,
      ev.occurred_at,
      ev.event_type,
      ev.model,
      ev.actor.raw_user_id,
      ev.usage.input_tokens,
      ev.usage.output_tokens,
      ev.cost.amount_usd,
    ],
  );
  const row = res.rows[0];
  return { inserted: row.inserted, revision: row.revision, event_id: row.event_id };
}

async function knownFingerprints(
  client: PoolClient,
  provider: string,
): Promise<{ fingerprints: Set<string>; paths: Set<string> }> {
  const res = await client.query<{ fingerprint: string }>(
    `SELECT DISTINCT fingerprint FROM raw_payloads WHERE provider = $1`,
    [provider],
  );
  const fingerprints = new Set<string>();
  const paths = new Set<string>();
  for (const r of res.rows) {
    fingerprints.add(r.fingerprint);
    for (const p of r.fingerprint.split("\n")) paths.add(p);
  }
  return { fingerprints, paths };
}

async function detectDrift(
  client: PoolClient,
  provider: string,
  raw: unknown,
  expects: string[],
  known: { fingerprints: Set<string>; paths: Set<string> },
): Promise<DriftAlert[]> {
  const candidates: DriftAlert[] = [];

  const structural = structuralDrift({
    provider,
    current: raw,
    knownFingerprints: known.fingerprints,
    knownPaths: known.paths,
  });
  if (structural) candidates.push(structural);

  const stats = await fieldStats(client, provider, expects);
  candidates.push(...silentNullDrift(provider, stats));

  // Persist, skipping alerts we've already raised. STRUCTURAL dedupes per
  // distinct new shape (fingerprint); SILENT_NULL dedupes per provider+field.
  const persisted: DriftAlert[] = [];
  for (const a of candidates) {
    const existing =
      a.type === "STRUCTURAL"
        ? await client.query(
            `SELECT 1 FROM drift_alerts
              WHERE provider = $1 AND type = 'STRUCTURAL' AND details->>'fingerprint' = $2
              LIMIT 1`,
            [a.provider, String(a.details.fingerprint ?? "")],
          )
        : await client.query(
            `SELECT 1 FROM drift_alerts
              WHERE provider = $1 AND type = $2 AND field IS NOT DISTINCT FROM $3
              LIMIT 1`,
            [a.provider, a.type, a.field],
          );
    if (existing.rowCount && existing.rowCount > 0) continue;
    await client.query(
      `INSERT INTO drift_alerts (provider, type, severity, field, message, details)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [a.provider, a.type, a.severity, a.field, a.message, JSON.stringify(a.details)],
    );
    persisted.push(a);
  }
  return persisted;
}

/**
 * Per expected field, baseline-vs-recent population counts. Baseline = history
 * excluding the recent window, so a fresh wave of nulls doesn't dilute the "was
 * reliably populated" signal it's supposed to trip.
 */
async function fieldStats(
  client: PoolClient,
  provider: string,
  expects: string[],
): Promise<FieldStat[]> {
  const fields = expects.filter((f) => FIELD_TO_COLUMN[f]);
  if (fields.length === 0) return [];

  const cols = fields.map((f) => FIELD_TO_COLUMN[f]!);
  const countCols = cols.map((c) => `count(${c})::int AS "${c}"`).join(", ");
  const total = await client.query(
    `SELECT count(*)::int AS seen, ${countCols} FROM events WHERE provider = $1`,
    [provider],
  );
  const recent = await client.query(
    `SELECT count(*)::int AS seen, ${countCols}
       FROM (SELECT * FROM events WHERE provider = $1
             ORDER BY ingested_at DESC, event_id LIMIT ${RECENT_WINDOW}) t`,
    [provider],
  );

  const t = total.rows[0];
  const r = recent.rows[0];
  return fields.map((field) => {
    const col = FIELD_TO_COLUMN[field]!;
    const recentSeen = r.seen as number;
    const recentPopulated = r[col] as number;
    return {
      field,
      overallSeen: (t.seen as number) - recentSeen,
      overallPopulated: (t[col] as number) - recentPopulated,
      recentSeen,
      recentPopulated,
    };
  });
}
