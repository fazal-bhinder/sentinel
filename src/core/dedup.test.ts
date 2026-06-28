import { describe, expect, it } from "vitest";
import { contentHash, dedupKey, deterministicUuid } from "./dedup";

describe("dedupKey", () => {
  it("is deterministic for the same identity", () => {
    const input = {
      provider: "openai",
      occurred_at: "2026-06-28T12:00:00.000Z",
      model: "gpt-4o",
      rawUserId: "u_1",
      contentHash: contentHash({ a: 1 }),
    };
    expect(dedupKey(input)).toBe(dedupKey(input));
  });

  it("ignores cost and tokens entirely (so backfill cannot duplicate)", () => {
    // Same identity + provider event id, different cost/token content.
    const a = dedupKey({
      provider: "openai",
      providerEventId: "oa_1",
      occurred_at: "2026-06-28T12:00:00.000Z",
      model: "gpt-4o",
      rawUserId: "u_1",
      contentHash: contentHash({ cost: null, tokens: 0 }),
    });
    const b = dedupKey({
      provider: "openai",
      providerEventId: "oa_1",
      occurred_at: "2026-06-28T12:00:00.000Z",
      model: "gpt-4o",
      rawUserId: "u_1",
      contentHash: contentHash({ cost: 0.12, tokens: 999 }),
    });
    expect(a).toBe(b);
  });

  it("changes when identity changes", () => {
    const base = {
      provider: "openai",
      occurred_at: "2026-06-28T12:00:00.000Z",
      model: "gpt-4o",
      rawUserId: "u_1",
      contentHash: "x",
    };
    expect(dedupKey(base)).not.toBe(dedupKey({ ...base, model: "gpt-4o-mini" }));
  });
});

describe("deterministicUuid", () => {
  it("is stable and a valid v4-shaped uuid", () => {
    const u = deterministicUuid("seed");
    expect(u).toBe(deterministicUuid("seed"));
    expect(u).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
