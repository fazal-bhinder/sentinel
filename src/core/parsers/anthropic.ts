import type { Parser } from "../parser";
import { assembleCanonical } from "../assemble";

export const anthropicV1: Parser = {
  provider: "anthropic",
  version: 1,
  expects: [
    "model",
    "usage.input_tokens",
    "usage.output_tokens",
    "cost.amount_usd",
    "actor.raw_user_id",
  ],
  parse(raw) {
    const r = raw as any;
    return assembleCanonical({
      provider: "anthropic",
      parser_version: 1,
      providerEventId: r.id ?? null,
      occurred_at: r.created_at ?? new Date(0).toISOString(),
      event_type: "chat",
      model: r.model ?? null,
      rawUserId: r.metadata?.user_id ?? null,
      input_tokens: r.usage?.input_tokens ?? null,
      output_tokens: r.usage?.output_tokens ?? null,
      cost: r.cost_usd ?? null,
      content: r.id ?? r,
    });
  },
};
