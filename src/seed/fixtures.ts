/**
 * Static JSON fixtures standing in for real provider payloads. Deterministic
 * (seeded by index) so the seed demo and the Vitest gate are reproducible.
 * Per the brief, these are fixtures on purpose — no real provider calls.
 */
const MODELS = {
  openai: ["gpt-4o", "gpt-4o-mini"],
  anthropic: ["claude-3-5-sonnet", "claude-3-5-haiku"],
  cursor: ["cursor-fast", "cursor-pro"],
} as const;

/** Spread events across the 4 weeks ending 2026-06-28 so weekly cost has shape. */
function occurredMs(i: number): number {
  const base = Date.UTC(2026, 5, 28, 12, 0, 0); // 2026-06-28T12:00:00Z
  return base - (i % 28) * 86_400_000 - ((i * 137) % 3600) * 1000;
}

function tokensFor(i: number): { in: number; out: number } {
  return { in: 200 + ((i * 7) % 1800), out: 50 + ((i * 13) % 900) };
}

function costFor(i: number): number {
  return Number((0.002 + ((i % 50) * 0.0003)).toFixed(6));
}

export function makeOpenAIClean(i: number): Record<string, unknown> {
  const t = tokensFor(i);
  return {
    id: `oa_${i}`,
    object: "chat.completion",
    created: Math.floor(occurredMs(i) / 1000),
    model: MODELS.openai[i % 2],
    user: `u_${i % 20}`,
    usage: { prompt_tokens: t.in, completion_tokens: t.out, total_tokens: t.in + t.out },
    cost: { amount_usd: costFor(i) },
  };
}

/** The "bad" payload: cost silently moved from `cost` to `pricing.cost`. */
export function makeOpenAIBad(i: number): Record<string, unknown> {
  const t = tokensFor(i);
  return {
    id: `oa_bad_${i}`,
    object: "chat.completion",
    created: Math.floor(occurredMs(i) / 1000),
    model: MODELS.openai[i % 2],
    user: `u_${i % 20}`,
    usage: { prompt_tokens: t.in, completion_tokens: t.out, total_tokens: t.in + t.out },
    pricing: { cost: { amount_usd: costFor(i) } },
  };
}

export function makeAnthropicClean(i: number): Record<string, unknown> {
  const t = tokensFor(i);
  return {
    id: `an_${i}`,
    type: "message",
    model: MODELS.anthropic[i % 2],
    created_at: new Date(occurredMs(i)).toISOString(),
    usage: { input_tokens: t.in, output_tokens: t.out },
    metadata: { user_id: `u_${i % 20}` },
    cost_usd: costFor(i),
  };
}

export function makeCursorClean(i: number): Record<string, unknown> {
  const t = tokensFor(i);
  return {
    request_id: `cu_${i}`,
    kind: "edit",
    model: MODELS.cursor[i % 2],
    timestamp: new Date(occurredMs(i)).toISOString(),
    tokens: { in: t.in, out: t.out },
    user: { id: `u_${i % 20}` },
    billing: { usd: costFor(i) },
  };
}

/** A payload whose cost arrives late: born null, same provider event id. */
export function makeOpenAINullCost(id: string): Record<string, unknown> {
  const p = makeOpenAIClean(7) as Record<string, unknown>;
  return { ...p, id, cost: { amount_usd: null } };
}

/** The follow-up that backfills the same dedup_key with a real cost. */
export function makeOpenAIBackfill(id: string): Record<string, unknown> {
  const p = makeOpenAIClean(7) as Record<string, unknown>;
  return { ...p, id, cost: { amount_usd: 0.0123 } };
}
