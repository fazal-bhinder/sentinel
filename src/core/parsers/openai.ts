import type { Parser } from "../parser";
import { assembleCanonical } from "../assemble";

const EXPECTS = [
  "model",
  "usage.input_tokens",
  "usage.output_tokens",
  "cost.amount_usd",
  "actor.raw_user_id",
];

/** v1: cost lives at the top level (`cost.amount_usd`). */
export const openaiV1: Parser = {
  provider: "openai",
  version: 1,
  expects: EXPECTS,
  parse(raw) {
    const r = raw as any;
    return assembleCanonical({
      provider: "openai",
      parser_version: 1,
      providerEventId: r.id ?? null,
      occurred_at: new Date((r.created ?? 0) * 1000).toISOString(),
      event_type: r.object === "text.completion" ? "completion" : "chat",
      model: r.model ?? null,
      rawUserId: r.user ?? null,
      input_tokens: r.usage?.prompt_tokens ?? null,
      output_tokens: r.usage?.completion_tokens ?? null,
      cost: r.cost?.amount_usd ?? null,
      content: r.id ?? r,
    });
  },
};

/**
 * v2 exists because the provider moved cost to `pricing.cost`. It is backward
 * compatible (still reads the old top-level location) so it parses both old and
 * new payloads — which is exactly why the replay matrix shows no regression.
 */
export const openaiV2: Parser = {
  provider: "openai",
  version: 2,
  expects: EXPECTS,
  parse(raw) {
    const r = raw as any;
    return assembleCanonical({
      provider: "openai",
      parser_version: 2,
      providerEventId: r.id ?? null,
      occurred_at: new Date((r.created ?? 0) * 1000).toISOString(),
      event_type: r.object === "text.completion" ? "completion" : "chat",
      model: r.model ?? null,
      rawUserId: r.user ?? null,
      input_tokens: r.usage?.prompt_tokens ?? null,
      output_tokens: r.usage?.completion_tokens ?? null,
      cost: r.pricing?.cost?.amount_usd ?? r.cost?.amount_usd ?? null,
      content: r.id ?? r,
    });
  },
};
