import { createHash } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Deterministic JSON: sorted keys, so content hashing is stable. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function contentHash(content: unknown): string {
  return sha256(stableStringify(content));
}

export interface DedupInput {
  provider: string;
  providerEventId?: string | null;
  occurred_at: string;
  model?: string | null;
  rawUserId?: string | null;
  contentHash: string;
}

/**
 * Contract 2 — deterministic dedup key.
 *
 * Derived ONLY from identity fields. Never cost/tokens: they get backfilled,
 * and if they were in the key a backfill would mint a duplicate row instead of
 * revising the existing one. Prefer a provider event id when present.
 */
export function dedupKey(input: DedupInput): string {
  if (input.providerEventId) {
    return sha256([input.provider, input.providerEventId].join("|"));
  }
  return sha256(
    [
      input.provider,
      input.occurred_at,
      input.model ?? "",
      input.rawUserId ?? "",
      input.contentHash,
    ].join("|"),
  );
}

/** Stable, valid v4-shaped UUID derived from a seed string (no randomness). */
export function deterministicUuid(seed: string): string {
  const h = sha256(seed);
  const c = h.slice(0, 32).split("");
  c[12] = "4"; // version nibble
  c[16] = "89ab"[parseInt(h[16]!, 16) % 4]!; // variant nibble
  const x = c.join("");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
