import type { Parser } from "../parser";
import { assembleCanonical } from "../assemble";

export const cursorV1: Parser = {
  provider: "cursor",
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
      provider: "cursor",
      parser_version: 1,
      providerEventId: r.request_id ?? null,
      occurred_at: r.timestamp ?? new Date(0).toISOString(),
      event_type: "edit",
      model: r.model ?? null,
      rawUserId: r.user?.id ?? null,
      input_tokens: r.tokens?.in ?? null,
      output_tokens: r.tokens?.out ?? null,
      cost: r.billing?.usd ?? null,
      content: r.request_id ?? r,
    });
  },
};
