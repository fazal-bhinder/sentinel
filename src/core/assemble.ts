import { CanonicalEvent, type EventType, type Provider } from "./canonical";
import { contentHash, dedupKey, deterministicUuid } from "./dedup";

/**
 * Shared assembly used by every parser: takes the fields a parser extracted
 * from a raw payload, derives the dedup key + a deterministic event id, fills
 * the canonical shape, and validates it. Keeping this in one place means all
 * parsers agree on identity and on what "null cost" looks like.
 *
 * `event_id` / `raw_payload_id` are derived deterministically from the dedup
 * key so a pure parse stays reproducible. `revision`/`ingested_at` here are
 * placeholders — the DB owns the real values, and replay ignores them.
 */
export interface CanonicalFields {
  provider: Provider;
  parser_version: number;
  providerEventId?: string | null;
  occurred_at: string;
  event_type: EventType;
  model?: string | null;
  rawUserId?: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  cost?: number | null;
  content: unknown; // basis for the content hash when there's no provider event id
}

export function assembleCanonical(f: CanonicalFields): CanonicalEvent {
  const dk = dedupKey({
    provider: f.provider,
    providerEventId: f.providerEventId ?? undefined,
    occurred_at: f.occurred_at,
    model: f.model ?? null,
    rawUserId: f.rawUserId ?? null,
    contentHash: contentHash(f.content),
  });

  return CanonicalEvent.parse({
    event_id: deterministicUuid(dk),
    dedup_key: dk,
    provider: f.provider,
    parser_version: f.parser_version,
    raw_payload_id: deterministicUuid(`${dk}|raw`),
    occurred_at: f.occurred_at,
    event_type: f.event_type,
    model: f.model ?? null,
    actor: { raw_user_id: f.rawUserId ?? null },
    usage: {
      input_tokens: f.input_tokens ?? null,
      output_tokens: f.output_tokens ?? null,
    },
    cost: { amount_usd: f.cost ?? null },
    revision: 1,
    ingested_at: f.occurred_at,
  });
}
