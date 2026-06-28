import { describe, expect, it } from "vitest";
import { CanonicalEvent } from "./canonical";
import { anthropicV1, cursorV1, openaiV1, openaiV2 } from "./parsers";
import {
  makeAnthropicClean,
  makeCursorClean,
  makeOpenAIBad,
  makeOpenAIClean,
} from "../seed/fixtures";

describe("parsers produce valid canonical events", () => {
  it("openai v1", () => {
    expect(() => CanonicalEvent.parse(openaiV1.parse(makeOpenAIClean(1)))).not.toThrow();
  });
  it("anthropic v1", () => {
    expect(() => CanonicalEvent.parse(anthropicV1.parse(makeAnthropicClean(1)))).not.toThrow();
  });
  it("cursor v1", () => {
    expect(() => CanonicalEvent.parse(cursorV1.parse(makeCursorClean(1)))).not.toThrow();
  });
});

describe("the silent-null case", () => {
  it("openai v1 does NOT throw on the bad payload, it reads cost=null", () => {
    const out = openaiV1.parse(makeOpenAIBad(3));
    expect(out.cost.amount_usd).toBeNull();
    expect(out.usage.input_tokens).not.toBeNull(); // everything else still parses
  });

  it("openai v2 reads the moved pricing.cost path", () => {
    const out = openaiV2.parse(makeOpenAIBad(3));
    expect(out.cost.amount_usd).not.toBeNull();
  });

  it("v1 and v2 agree on identity (same dedup_key) for the same payload", () => {
    const raw = makeOpenAIClean(5);
    expect(openaiV1.parse(raw).dedup_key).toBe(openaiV2.parse(raw).dedup_key);
  });
});
