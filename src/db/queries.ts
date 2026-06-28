import type { CanonicalEvent } from "../core/canonical";
import type { CorpusItem } from "../core/replay";
import { pool } from "./pool";

export async function resetAll(): Promise<void> {
  await pool.query("TRUNCATE events, raw_payloads, drift_alerts RESTART IDENTITY");
}

export async function recentEvents(limit = 50) {
  const res = await pool.query(
    `SELECT event_id, dedup_key, provider, parser_version, occurred_at, event_type,
            model, raw_user_id, input_tokens, output_tokens, cost_amount_usd, revision, ingested_at
       FROM events ORDER BY ingested_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
}

export async function listAlerts() {
  const res = await pool.query(
    `SELECT id, provider, type, severity, field, message, details, created_at
       FROM drift_alerts ORDER BY created_at DESC, id DESC`,
  );
  return res.rows;
}

/** Per-provider health: latest parser version seen, event count, last payload. */
export async function providerHealth() {
  const res = await pool.query(
    `SELECT provider,
            count(*)::int                       AS events,
            max(parser_version)::int            AS parser_version,
            max(ingested_at)                    AS last_ingest,
            max(occurred_at)                    AS last_occurred,
            count(*) FILTER (WHERE cost_amount_usd IS NULL)::int AS missing_cost
       FROM events GROUP BY provider ORDER BY provider`,
  );
  return res.rows;
}

/** Weekly cost per provider + the honest missing-cost undercount. */
export async function metrics() {
  const weekly = await pool.query(
    `SELECT provider,
            date_trunc('week', occurred_at)::date AS week,
            coalesce(sum(cost_amount_usd), 0)::float AS cost_usd,
            count(*)::int AS events
       FROM events
      GROUP BY provider, week
      ORDER BY week, provider`,
  );
  const missing = await pool.query(
    `SELECT provider, count(*) FILTER (WHERE cost_amount_usd IS NULL)::int AS missing_cost
       FROM events GROUP BY provider ORDER BY provider`,
  );
  return { weekly: weekly.rows, missing_cost: missing.rows };
}

/**
 * Field vitals for the hero: recent populated/null series per field per
 * provider. The series reads oldest -> newest so the trace draws left to right.
 */
export async function vitals(window = 40) {
  const fields: { key: string; col: string }[] = [
    { key: "model", col: "model" },
    { key: "input_tokens", col: "input_tokens" },
    { key: "output_tokens", col: "output_tokens" },
    { key: "cost.amount_usd", col: "cost_amount_usd" },
  ];

  const res = await pool.query(
    `SELECT provider, model, input_tokens, output_tokens, cost_amount_usd, ingested_at
       FROM events ORDER BY ingested_at DESC`,
  );

  const byProvider = new Map<string, any[]>();
  for (const row of res.rows) {
    if (!byProvider.has(row.provider)) byProvider.set(row.provider, []);
    const arr = byProvider.get(row.provider)!;
    if (arr.length < window) arr.push(row);
  }

  const out: Record<string, unknown>[] = [];
  for (const [provider, rows] of byProvider) {
    const ordered = rows.slice().reverse(); // oldest -> newest
    const recent = ordered.slice(-20);
    const fieldVitals = fields.map((f) => {
      const series: number[] = ordered.map((r) => (r[f.col] === null ? 0 : 1));
      const recSeries: number[] = recent.map((r) => (r[f.col] === null ? 0 : 1));
      const rate = recSeries.length
        ? recSeries.reduce((a, b) => a + b, 0) / recSeries.length
        : 1;
      const state = rate >= 0.9 ? "alive" : rate <= 0.1 ? "dark" : "warn";
      return { field: f.key, series, rate, state };
    });
    out.push({ provider, fields: fieldVitals });
  }
  return out;
}

/** Load the full replay corpus (distinct raw payloads + their golden). */
export async function loadCorpus(): Promise<CorpusItem[]> {
  const res = await pool.query(
    `SELECT provider, payload, golden FROM raw_payloads ORDER BY received_at`,
  );
  return res.rows.map((r) => ({
    provider: r.provider as string,
    raw: r.payload,
    golden: r.golden as CanonicalEvent,
  }));
}
