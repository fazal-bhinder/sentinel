import { describe, expect, it } from "vitest";
import { buildRegistry } from "./registry";
import { type CorpusItem, runReplay } from "./replay";
import {
  makeAnthropicClean,
  makeCursorClean,
  makeOpenAIBad,
  makeOpenAIClean,
} from "../seed/fixtures";

/**
 * Build a corpus the way ingest would: golden = the v1 parser output captured
 * at ingest time. Includes the "bad" openai payloads (golden cost = null).
 */
function buildCorpus(): CorpusItem[] {
  const v1 = buildRegistry();
  const items: CorpusItem[] = [];
  for (let i = 0; i < 40; i++) {
    const oa = makeOpenAIClean(i);
    const an = makeAnthropicClean(i);
    const cu = makeCursorClean(i);
    items.push({ provider: "openai", raw: oa, golden: v1.get("openai", 1)!.parse(oa) });
    items.push({ provider: "anthropic", raw: an, golden: v1.get("anthropic", 1)!.parse(an) });
    items.push({ provider: "cursor", raw: cu, golden: v1.get("cursor", 1)!.parse(cu) });
  }
  for (let i = 0; i < 10; i++) {
    const bad = makeOpenAIBad(i);
    items.push({ provider: "openai", raw: bad, golden: v1.get("openai", 1)!.parse(bad) });
  }
  return items;
}

const nonOpenai = (cells: ReturnType<typeof runReplay>) =>
  cells
    .filter((c) => c.provider !== "openai")
    .map((c) => ({ ...c, throwReasons: [] }))
    .sort((a, b) => `${a.provider}${a.version}`.localeCompare(`${b.provider}${b.version}`));

describe("replay regression gate", () => {
  const corpus = buildCorpus();

  it("(a) every historical payload still parses under every version", () => {
    const cells = runReplay(buildRegistry({ openaiV2: true }), corpus);
    expect(cells.every((c) => c.throw === 0)).toBe(true);
  });

  it("(b) changing the openai parser produces zero new failures for the other providers", () => {
    const before = nonOpenai(runReplay(buildRegistry(), corpus));
    const after = nonOpenai(runReplay(buildRegistry({ openaiV2: true }), corpus));
    expect(after).toEqual(before);
  });

  it("the clean corpus replays all green under v1", () => {
    const cleanOnly = corpus.filter((c) => !(c.raw as any).pricing);
    const cells = runReplay(buildRegistry(), cleanOnly);
    expect(cells.every((c) => c.status === "green")).toBe(true);
  });

  it("openai v2 reparses the bad payloads (drift vs the v1 golden), never throwing", () => {
    const cells = runReplay(buildRegistry({ openaiV2: true }), corpus);
    const v2 = cells.find((c) => c.provider === "openai" && c.version === 2)!;
    expect(v2.throw).toBe(0);
    expect(v2.drift).toBeGreaterThan(0); // the 10 bad payloads now read cost, differing from golden
  });
});
