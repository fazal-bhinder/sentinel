import { z } from "zod";

/**
 * Contract 1 — the one shape every reader reads.
 *
 * Design rule: identity fields are stable; cost and tokens are facts that
 * arrive late and stay revisable. Identity drives the dedup key; cost/tokens
 * never do (so a late backfill updates a row instead of creating a duplicate).
 */
export const PROVIDERS = ["openai", "anthropic", "cursor"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const EVENT_TYPES = ["chat", "completion", "edit"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const CanonicalEvent = z.object({
  event_id: z.string().uuid(),
  dedup_key: z.string(), // deterministic idempotency key
  provider: z.enum(PROVIDERS),
  parser_version: z.number().int(),
  raw_payload_id: z.string().uuid(),
  occurred_at: z.string().datetime(),
  event_type: z.enum(EVENT_TYPES),
  model: z.string().nullable(),
  actor: z.object({ raw_user_id: z.string().nullable() }),
  usage: z.object({
    input_tokens: z.number().nullable(),
    output_tokens: z.number().nullable(),
  }),
  cost: z.object({ amount_usd: z.number().nullable() }), // born null, backfilled
  revision: z.number().int(),
  ingested_at: z.string().datetime(),
});

export type CanonicalEvent = z.infer<typeof CanonicalEvent>;

/**
 * Fields assigned by the ingest/DB layer rather than derived from the raw
 * payload. The replay differ ignores these so it compares only the *semantic*
 * output of a parser, not row bookkeeping.
 */
export const VOLATILE_FIELDS = [
  "event_id",
  "raw_payload_id",
  "ingested_at",
  "revision",
  "parser_version",
] as const;
